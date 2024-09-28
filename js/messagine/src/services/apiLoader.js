import http from "./http";
import { jwtDecode } from 'jwt-decode';

const masterKey = process.env.REACT_APP_API_KEY;

export default async function apiLoader({ 
  api, 
  payload, 
  userId 
}) {

  let server = null;

  if (!userId) {

    const jwt = localStorage.getItem("messagine.token")

    if (jwt) {
      
      const { userRecord } = jwtDecode(jwt)
      userId = userRecord.user_id

    }

  }

  // Fallback to using masterKey if the user is not logged in yet.

  if (!userId) userId = masterKey;

  // Add masterKey and userId to every payload.

  payload = {
    ...payload,
    masterKey,
    userId
  }

  server = `${process.env.REACT_APP_API}/`;

  const result = await http.post(server + api, payload);
  return result;

}