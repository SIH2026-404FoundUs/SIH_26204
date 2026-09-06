// This function wraps a SUCCESSFUL result in the standard shape
function ok(data, meta) {
  return {
    ok: true,
    data: data,
    meta: Object.assign({ fetchedAt: new Date() }, meta)
  };
}

// This function wraps a FAILED result in the standard shape
function fail(error, meta) {
  return {
    ok: false,
    error: error,
    meta: Object.assign({ fetchedAt: new Date() }, meta)
  };
}

// This makes both functions usable in other files
export {ok,fail}