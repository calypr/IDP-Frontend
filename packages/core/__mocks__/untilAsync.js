const until = async (callback) => {
  try {
    return [null, await callback()];
  } catch (error) {
    return [error, null];
  }
};

module.exports = { until };
