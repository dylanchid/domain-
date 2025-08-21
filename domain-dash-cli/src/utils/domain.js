const validExtensions = ['.com', '.org', '.net', '.co', '.io', '.dev', '.app', '.ai'];

function isValidDomain(domain) {
  const domainRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/;
  return domainRegex.test(domain);
}

function normalizeDomain(domain) {
  return domain.toLowerCase().trim();
}

function extractExtension(domain) {
  const ext = validExtensions.find(extension => domain.endsWith(extension));
  return ext ? ext : null;
}

function isExtensionValid(domain) {
  const ext = extractExtension(domain);
  return ext !== null;
}

function validateDomain(domain) {
  const normalizedDomain = normalizeDomain(domain);
  if (!isValidDomain(normalizedDomain)) {
    throw new Error('Invalid domain format');
  }
  if (!isExtensionValid(normalizedDomain)) {
    throw new Error('Domain extension is not supported');
  }
  return normalizedDomain;
}

module.exports = {
  isValidDomain,
  normalizeDomain,
  extractExtension,
  isExtensionValid,
  validateDomain
};