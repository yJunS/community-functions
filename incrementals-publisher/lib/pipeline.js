/*
 * This module has a few functions which help process Pipeline related metadata
 */
const { URL } = require('url');

module.exports = {
  /*
   * takes in a JSON object expected to be returned by JSON API
   * requests to Jenkins such as:
   * https://ci.jenkins.io/job/structs-plugin/job/PR-36/3/api/json?tree=actions[revision[hash,pullHash]]
   *
   * @return Object containing a `hash` property
   */
  processBuildMetadata: (metadata) => {
    let response = {};

    metadata.actions.forEach((action) => {
      if (action._class === 'jenkins.scm.api.SCMRevisionAction') {
        response.hash = action.revision.hash || action.revision.pullHash;
      }
    });

    return response;
  },

  /*
   * Return a generated API URL for fetching specific commit information for
   * this Pipeline
   */
  getBuildApiUrl: (build_url) => {
    return build_url + 'api/json?tree=actions[revision[hash,pullHash]]';
  },

  /*
   * takes in a JSON object expected to be returned by JSON API
   * requests to Jenkins such as:
   * https://ci.jenkins.io/job/structs-plugin/api/json?tree=sources[source[repoOwner,repository]]
   *
   * @return Object containing `owner` and `repo` properties
   */
  processFolderMetadata: (metadata) => {
    let response = {};

    metadata.sources.forEach((source) => {
      response.owner = source.source.repoOwner;
      response.repo = source.source.repository;
    });

    return response;
  },

  /*
   * Return a generated API URL for fetching repository information for
   * this Pipeline
   */
  getFolderApiUrl: (build_url) => {
    return build_url + '../../../api/json?tree=sources[source[repoOwner,repository]]';
  },

  /*
   * Return the generated URL to the archive.zip generated by some incrementals
   * build tooling (consult JEP-305)
   */
  getArchiveUrl: (build_url, hash) => {
    return build_url + 'artifact/**/*-rc*.' + hash + '/*-rc*.' + hash + '*/*zip*/archive.zip';
  },

  /*
   * Return the owner and repo name for the given GitHub URL, e.g.
   * https://github.com/jenkinsci/blueocean-plugin.git would return:
   *   .owner: jenkinsci
   *   .repo: blueocean-plugin
   */
  getRepoFromUrl: (remote_url) => {
    const url = new URL(remote_url);

    if (url.hostname != 'github.com') {
      throw new Error('I only expect URLs from github.com');
    }

    const parts = url.pathname.match(/^\/([\w'-]+)\/([\w'-]+)(.git)?/);

    return {
      owner: parts[1],
      repo: parts[2],
    };
  }
};
