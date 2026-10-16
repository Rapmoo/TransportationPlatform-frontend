const PHONE_RE = /^(?:\+?251|0)(?:9|7)\d{8}$/;

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
  const compact = trimmed(value).replace(/[\s-]/g, '');
  return PHONE_RE.test(compact);
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
  ];

  requiredFields.forEach((field) => {
    if (!isRequiredFilled(values[field])) {
      errors[field] = t('errorRequired');
    }
  });

  const englishTextFields = [
    'firstName', 'middleName', 'lastName', 'organization', 'homeAddress',
    'startPointAddress', 'boardingAddress', 'afterWorkAddress',
    'busNumberGoing', 'busNumberReturn',
  ];
  englishTextFields.forEach((field) => {
    if (isRequiredFilled(values[field]) && !hasOnlyEnglishLetters(values[field])) {
      errors[field] = t('errorEnglishOnly');
    }
  });

  if (!errors.faydaId && !isValidFaydaId(values.faydaId)) {
    errors.faydaId = t('errorFaydaIdInvalid');
  }

  if (!errors.phoneNumber && !isValidPhone(values.phoneNumber)) {
    errors.phoneNumber = t('errorPhoneInvalid');
  }

  return errors;
}

export function allLocationsConfirmed(locations) {
  return ['home', 'start', 'boarding', 'afterWork'].every(
    (key) => locations[key] && locations[key].confirmed && locations[key].lat != null && locations[key].lon != null
  );
}