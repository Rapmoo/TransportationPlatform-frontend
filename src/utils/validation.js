const PHONE_RE = /^0[79]\d{8}$/;

export function trimmed(value) {
  return typeof value === 'string' ? value.trim() : value;
}

// Normalize short answer fields to consistent English title capitalization.
// The form intentionally keeps interface language separate from answer language.
export function capitalizeEnglishWords(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/[\p{Script=Latin}][\p{Script=Latin}\p{M}]*/gu, (word) => {
    // Keep intentional acronyms such as SSGI or USA in uppercase.
    if (word === word.toLocaleUpperCase('en-US')) return word;
    return word.charAt(0).toLocaleUpperCase('en-US')
      + word.slice(1).toLocaleLowerCase('en-US');
  });
}

// Capitalize the beginning of each sentence while preserving the sentence's
// remaining wording and punctuation (used for free-text correction reasons).
export function capitalizeSentenceStarts(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/(^|[.!?]\s+)([a-z])/g, (_, separator, letter) => (
    separator + letter.toLocaleUpperCase('en-US')
  ));
}

// English answers may include digits, punctuation, and place-name accents, but
// must not contain letters from non-Latin writing systems (e.g. Amharic script).
export function hasOnlyEnglishLetters(value) {
  if (typeof value !== 'string') return true;
  return !Array.from(value).some((character) => (
    /\p{L}/u.test(character) && !/\p{Script=Latin}/u.test(character)
  ));
}

export function isRequiredFilled(value) {
  return typeof trimmed(value) === 'string' && trimmed(value).length > 0;
}

export function isValidPhone(value) {
  return PHONE_RE.test(trimmed(value) || '');
}

// ---- Input sanitizers (used while typing) -------------------------------
export const digitsOnly = (value, max) => {
  const d = String(value ?? '').replace(/\D/g, '');
  return max ? d.slice(0, max) : d;
};

// Text answers need at least 3 letters (rejects entries like "ab" or "jk").
export const MIN_LETTERS = 3;
export const hasMinLetters = (value) => (
  (String(value ?? '').match(/\p{L}/gu) || []).length >= MIN_LETTERS
);

// Names: letters, spaces, hyphen, apostrophe. No digits or symbols.
const NAME_BAD_RE = /[^\p{Script=Latin}\p{M}\s'’-]/gu;
export const sanitizeName = (value) => String(value ?? '').replace(NAME_BAD_RE, '');
export const isValidName = (value) => {
  const v = trimmed(value) || '';
  return v.length > 0 && !/[^\p{Script=Latin}\p{M}\s'’-]/u.test(v) && /\p{L}/u.test(v);
};

// Places (workplace, residential area, boarding points): letters, digits,
// spaces and . - ' only. No other special characters.
const PLACE_BAD_RE = /[^\p{Script=Latin}\p{M}\d\s.'’-]/gu;
export const sanitizePlace = (value) => String(value ?? '').replace(PLACE_BAD_RE, '');
export const isValidPlace = (value) => {
  const v = trimmed(value) || '';
  return v.length > 0 && !/[^\p{Script=Latin}\p{M}\d\s.'’-]/u.test(v) && /\p{L}/u.test(v);
};

// Public bus ID: 16 digits.
export function isValidPublicBusId(value) {
  return /^\d{16}$/.test(trimmed(value) || '');
}

// Fayda ID: 16-digit national ID number.
const FAYDA_ID_RE = /^\d{16}$/;

export function isValidFaydaId(value) {
  return FAYDA_ID_RE.test(trimmed(value) || '');
}


export function normalizeNamePart(value) {
  const cleaned = trimmed(value).replace(/\s+/g, ' ');
  return capitalizeEnglishWords(cleaned);
}

export function normalizePersonalNames(values) {
  return {
    ...values,
    firstName: normalizeNamePart(values.firstName),
    middleName: normalizeNamePart(values.middleName),
    lastName: normalizeNamePart(values.lastName),
  };
}

export function buildFullName(personal) {
  return [personal.firstName, personal.middleName, personal.lastName]
    .map((part) => (trimmed(part) || ''))
    .filter(Boolean)
    .join(' ');
}

/**
 * Validates the personal/employment/transportation form step.
 * Returns a { fieldName: errorMessageKey } map; empty object means valid.
 */
export function validatePersonalForm(values, t) {
  const errors = {};
  const requiredFields = [
    'faydaId',
    'firstName',
    'middleName',
    'lastName',
    'phoneNumber',
    'organization',
    'homeAddress',
    'startPointAddress',
    'boardingAddress',
    'afterWorkAddress',
    'busNumberGoing',
    'busNumberReturn',
    'publicBusId',
  ];

  requiredFields.forEach((field) => {
    if (!isRequiredFilled(values[field])) {
      errors[field] = t('errorRequired');
    }
  });

  ['firstName', 'middleName', 'lastName'].forEach((field) => {
    if (!errors[field] && !isValidName(values[field])) {
      errors[field] = t('errorNameLettersOnly');
    } else if (!errors[field] && !hasMinLetters(values[field])) {
      errors[field] = t('errorTooFewLetters');
    }
  });

  ['organization', 'homeAddress', 'startPointAddress', 'boardingAddress', 'afterWorkAddress'].forEach((field) => {
    if (!errors[field] && !isValidPlace(values[field])) {
      errors[field] = t('errorNoSpecialChars');
    } else if (!errors[field] && !hasMinLetters(values[field])) {
      errors[field] = t('errorTooFewLetters');
    }
  });

  ['busNumberGoing', 'busNumberReturn'].forEach((field) => {
    if (!errors[field] && !/^\d+$/.test(trimmed(values[field]))) {
      errors[field] = t('errorDigitsOnly');
    }
  });

  if (!errors.faydaId && !isValidFaydaId(values.faydaId)) {
    errors.faydaId = t('errorFaydaIdInvalid');
  }

  if (!errors.phoneNumber && !isValidPhone(values.phoneNumber)) {
    errors.phoneNumber = t('errorPhoneInvalid');
  }

  if (!errors.publicBusId && !isValidPublicBusId(values.publicBusId)) {
    errors.publicBusId = t('errorPublicBusIdInvalid');
  }

  return errors;
}

export function allLocationsConfirmed(locations) {
  return ['home', 'start', 'boarding', 'afterWork'].every(
    (key) => locations[key] && locations[key].confirmed && locations[key].lat != null && locations[key].lon != null
  );
}