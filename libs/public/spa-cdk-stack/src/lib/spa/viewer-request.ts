/** What the viewer-request CloudFront Function of a SPA does. */
export interface ViewerRequestOptions {
  /** See `SpaProps.redirectTrailingSlash`. */
  redirectTrailingSlash?: boolean;
  /** See `SpaProps.resolveFolderIndex`. */
  resolveFolderIndex?: boolean;
}

/**
 * Whether `resolveFolderIndex` serves `path` from its `index.html`: no `.` in
 * its last segment. The deployed function holds the same rule in ES5, and the
 * spec checks that both agree.
 */
export function servesFolderIndex(path: string): boolean {
  return path.indexOf('.', path.lastIndexOf('/')) < 0;
}

/**
 * The source of the CloudFront Function behind `SpaProps.redirectTrailingSlash`
 * and `SpaProps.resolveFolderIndex`, for runtime `cloudfront-js-2.0` (plain
 * ES5). A cache behaviour takes one function per event, so both options share
 * it, each as a literal switch at its top. Kept as source text, so the spec
 * runs exactly the code that is deployed.
 *
 * A path ending in `/` (other than `/`) is redirected to the path without it
 * or, without that option, served from its `index.html`; an extension-less
 * path (no `.` in its last segment) is served from `<path>/index.html`. The
 * redirect keeps a single leading slash, so it never leaves the site.
 */
export function viewerRequestSource({
  redirectTrailingSlash = false,
  resolveFolderIndex = false,
}: ViewerRequestOptions): string {
  return `
var REDIRECT_TRAILING_SLASH = ${redirectTrailingSlash};
var RESOLVE_FOLDER_INDEX = ${resolveFolderIndex};

function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.length < 2) {
    return request;
  }
  if (uri.charAt(uri.length - 1) === '/') {
    if (REDIRECT_TRAILING_SLASH) {
      return redirectToBarePath(request);
    }
    if (RESOLVE_FOLDER_INDEX) {
      request.uri = uri + 'index.html';
    }
    return request;
  }
  if (RESOLVE_FOLDER_INDEX && uri.indexOf('.', uri.lastIndexOf('/')) < 0) {
    request.uri = uri + '/index.html';
  }
  return request;
}

function redirectToBarePath(request) {
  // One leading slash only: '//evil.com' would leave the site.
  var path = '/' + request.uri.replace(/^[\\/\\\\]+/, '').replace(/\\/+$/, '');
  var query = [];
  Object.keys(request.querystring).forEach(function (key) {
    var entry = request.querystring[key];
    var values = entry.multiValue || [entry];
    values.forEach(function (item) {
      query.push(key + '=' + item.value);
    });
  });
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: query.length ? path + '?' + query.join('&') : path },
    },
  };
}
`;
}
