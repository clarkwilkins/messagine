import { jwtDecode } from 'jwt-decode';

export function getToken() {

  return localStorage.getItem('messagine.token');

}

export function decodeToken(token) {

  try {
  
    return jwtDecode(token);

  } catch (e) {

    return null;

  }

}

export function removeToken() {

  localStorage.removeItem('messagine.token');

}