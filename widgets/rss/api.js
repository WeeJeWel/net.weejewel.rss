'use strict';

module.exports = {
  async getFeed({ homey, query }) {
    const { url } = query;
    return homey.app.getFeed({ url });
  },
};
