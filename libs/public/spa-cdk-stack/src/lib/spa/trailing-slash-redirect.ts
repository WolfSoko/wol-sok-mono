/**
 * The CloudFront Function behind `SpaProps.redirectTrailingSlash`, for runtime
 * `cloudfront-js-2.0` (plain ES5). The target keeps a single leading slash, so
 * it never leaves the site. Kept as source text, so the spec runs exactly the
 * code that is deployed.
 */
export const TRAILING_SLASH_REDIRECT_SOURCE = `
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.length < 2 || uri.charAt(uri.length - 1) !== '/') {
    return request;
  }
  // One leading slash only: '//evil.com' would leave the site.
  var path = '/' + uri.replace(/^[\\/\\\\]+/, '').replace(/\\/+$/, '');
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
