const fetchText = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`HTTP_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.text();
};

module.exports = {
  fetchText,
};
