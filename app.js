'use strict';

const url = require('url');

const Homey = require('homey');
const RSSParser = require('rss-parser');
const fetch = require('node-fetch');

module.exports = class RSSApp extends Homey.App {

  async onInit() {
    this.parser = new RSSParser();
  }

  async getFeed({ url }) {
    try {
      const feed = await this.parser.parseURL(url);

      const result = {
        title: feed.title,
        items: feed.items.map(item => ({
          title: item.title,
          link: item.link,
          date: new Date(item.isoDate),
          preview: item.contentSnippet,
          content: item.content,
          image: item.enclosure
            ? item.enclosure.url
            : null,
        })),
      };

      try {
        result.image = await this.getWebsiteImage(feed.link);
      } catch (err) {
        this.error(`Error Getting Website Image: ${err.message}`);
      }

      return result;
    } catch (err) {
      this.error(err);
      throw err;
    }
  }

  async getWebsiteImage(siteUrl) {
    const html = await fetch(siteUrl).then(res => res.text());

    // Search for <link rel="icon" ...
    const faviconRegex = /<link[^>]*rel=["']icon["'][^>]*>/i;
    const faviconMatch = html.match(faviconRegex);

    if (faviconMatch) {
      // Extract the href attribute
      const hrefRegex = /href=["']([^"']+)["']/i;
      const hrefMatch = faviconMatch[0].match(hrefRegex);

      if (hrefMatch && hrefMatch[1]) {
        let faviconUrl = hrefMatch[1];

        // Resolve the relative URL if necessary
        if (!faviconUrl.startsWith('http')) {
          faviconUrl = url.resolve(siteUrl, faviconUrl);
        }

        return faviconUrl;
      }
    }

    // Search for the manifest link tag
    const manifestLinkRegex = /<link[^>]*rel=["']manifest["'][^>]*>/i;
    const match = html.match(manifestLinkRegex);

    if (match) {
      // Extract the href attribute
      const hrefRegex = /href=["']([^"']+)["']/i;
      const hrefMatch = match[0].match(hrefRegex);

      if (!hrefMatch || !hrefMatch[1]) {
        throw new Error('Manifest href not found');
      }

      let manifestUrl = hrefMatch[1];

      // Resolve the relative URL if necessary
      if (!manifestUrl.startsWith('http')) {
        manifestUrl = url.resolve(siteUrl, manifestUrl);
      }

      // Fetch the manifest
      const manifestJson = await fetch(manifestUrl).then(res => res.json());

      // Find an icon
      manifestJson.icons.sort((a, b) => {
        return parseInt(a.sizes) - parseInt(b.sizes);
      });
      if (manifestJson.icons.length > 0) {
        result.image = manifestJson.icons[0].src;
      }
    }

    // Fallback to Google Favicon API
    return `https://www.google.com/s2/favicons?domain=${siteUrl}&sz=${128}`;
  }

};
