import axios from "axios";

// intercept unexpected errors

axios.interceptors.response.use( null, ( error ) => {

  if ( error.code === 'ERR_NETWORK' ) {

    console.log( 'Network error' ); // don't throw exceptions on network errors
    return Promise.reject( { networkError: true } );

 }

  const expectedError =
    error.response &&
    error.response.status >= 400 &&
    error.response.status < 500;

  if ( !expectedError ) console.log( error.code );

  return Promise.reject( error );

});

export default {
  get: axios.get,
  post: axios.post,
  put: axios.put,
  delete: axios.delete,
};