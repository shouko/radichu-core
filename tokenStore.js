const store = {};

const get = (key) => {
  if (!store[key]) return false;
  if (store[key].expires < Date.now()) {
    delete store[key];
    return false;
  }
  return store[key].value;
};

const set = (key, value) => {
  store[key] = {
    value,
    expires: Date.now() + 42e5,
  };
};

module.exports = {
  get,
  set,
};
