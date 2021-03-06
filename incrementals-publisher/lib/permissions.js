/*
 * This module just has some helpers to make checking permissions easier
 */

const fetch     = require('node-fetch');
const StreamZip = require('node-stream-zip');
const util      = require('util');
const xml2js    = require('xml2js');

const PERMISSIONS_URL = process.env.PERMISSIONS_URL || 'https://ci.jenkins.io/job/Infra/job/repository-permissions-updater/job/master/lastSuccessfulBuild/artifact/json/github.index.json'

module.exports = {
  fetch: () => {
    return fetch(PERMISSIONS_URL);
  },

  verify: (log, target, archive, entries, permsResponse, owner, repo, hash) => {
    return new Promise(async (resolve, reject) => {
      const permissions = await permsResponse.json();
      const applicable = permissions[target];

      if (!applicable) {
        reject(util.format('No applicable permissions for %s', target));
      }

      const zip = new StreamZip({file: archive});
      zip.on('entry', (entry) => {
        entries.push(entry.name);
        let ok = false;
        applicable.forEach((path) => {
          if (entry.name.startsWith(path)) {
            ok = true;
          }
        });
        if (!ok) {
          reject(util.format('No permissions for %s', entry.name));
        }
        if (entry.name.endsWith('.pom')) {
          const pomXml = zip.entryDataSync(entry.name);
          xml2js.parseString(pomXml, (err, result) => {
            if (!result.project.scm) {
              reject(util.format('Missing <scm> section in %s', entry.name));
            }
            const scm = result.project.scm[0];
            if (!scm.url) {
              reject(util.format('Missing <url> section in <scm> of %s', entry.name));
            }
            const url = scm.url[0];
            if (!scm.tag) {
              reject(util.format('Missing <tag> section in <scm> of %s', entry.name));
            }
            const tag = scm.tag[0];
            const groupId = result.project.groupId[0];
            const artifactId = result.project.artifactId[0];
            const version = result.project.version[0];
            log.info('Parsed %s with url=%s tag=%s GAV=%s:%s:%s', entry.name, url, tag, groupId, artifactId, version);
            const expectedPath = groupId.replace(/[.]/g, '/') + '/' + artifactId + '/' + version + '/' + artifactId + '-' + version + '.pom';
            if (tag !== hash) {
              reject('Wrong commit hash in /project/scm/tag');
            } else if (!url.match('^https?://github[.]com/' + owner + '/' + repo + '([.]git)?(/.*)?$')) {
              reject('Wrong URL in /project/scm/url');
            } else if (expectedPath !== entry.name) {
              reject(util.format('Wrong GAV: %s vs. %s', expectedPath, entry.name));
            }
          });
        }
      });

      zip.on('ready', () => {
        zip.close();
        resolve(true);
      });

      zip.on('error', (err) => { reject('ZIP error: ' + err); });
    });
  },
};
