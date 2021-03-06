/* global fetch, Request, Headers */
import Cookies from 'js-cookie'
import { CP_ADMIN_API, CP_AGGREGATOR_URL, LOGIN_URL } from '../constants/app_constants'
import { routeUtils } from '../helpers/router'

const LOGIN_URL_WITH_REDIRECT = `${LOGIN_URL}?return_url=${CP_AGGREGATOR_URL}`
const REFRESH_TOKEN_URL = `${CP_ADMIN_API}api_session/refresh`
const MAXIMUM_RESTARTED_REQUESTS = 4
const PROFILE_URL = `${CP_ADMIN_API}profile`

let restartedRequests = []

export const getProfile = () => get(PROFILE_URL).then(parseJSON)

const refreshToken = () => post(REFRESH_TOKEN_URL, { refresh_token: getRefreshToken() })

const redirectToLoginPage = () => routeUtils.redirectTo(LOGIN_URL_WITH_REDIRECT)

const getAccessToken = () => Cookies.get('accessToken')

const setAccessToken = (newToken) => Cookies.set('accessToken', newToken)

const getRefreshToken = () => Cookies.get('refreshToken')

/* The access token is a JWT token, which is three strings separated by ".":
 *   <jwt_metadata>.<payload>.<signature>
 *
 * The jwt_metadata and payload are both base64 encoded. The payload is esentially
 * our "user" object.
 *
 * TODO: Handle the non-existence of the accessToken, e.g. if someone's logged
 * out in another tab. In this case, we want to go through the same refresh/redirect
 * process as resolveRejectedRequest
 */
export const currentUser = () => JSON.parse(window.atob(getAccessToken().split('.')[1]))

const restartRequest = (request) => {
  restartedRequests.push(request)
  return makeRequest(new Request(request, {headers: {'Authorization': getAccessToken()}}))
}

const maximumRestartedRequests = () => restartedRequests.length >= MAXIMUM_RESTARTED_REQUESTS

/*
* Clean the list of restarted requests except the calls to refresh token API endpoint
* which is called before the request is restarted.
*/
const cleanRestartedRequests = (response) => {
  if (!response || response.url.url !== REFRESH_TOKEN_URL) {
    restartedRequests = []
  }
}

/*
* In the case of unauthorized request (401), the access token is refreshed and
* previous ajax call is restarted. If the refresh token call fail for the reason of invalid reset token
* or any other, the user is redirected to login page.
* There can be a case when API keep returning 401 and this would lead to the infinite loop of ajax calls. For these reasons
* we allow to repeat ajax calls just MAXIMUM_RESTARTED_REQUESTS times. If this limit exceed, the user is redirected to the login page.
*/
// TODO: app fails if client_portal-admin-backend is down
const resolveRejectedRequest = (request) => {
  return refreshToken()
  .then(parseJSON)
  .then((refreshTokenResponse) => {
    if (maximumRestartedRequests()) {
      cleanRestartedRequests(request) // We need to clean the restarted requests to be able to test this
      return redirectToLoginPage()
    }
    setAccessToken(refreshTokenResponse.access_token)
    return restartRequest(request)
  })
  .catch(redirectToLoginPage)
}

const handleResponse = (request) => (response) => {
  if (response.status >= 200 && response.status < 300) {
    cleanRestartedRequests(response)
    return response
  } else if (response.status === 401) {
    return resolveRejectedRequest(request)
  } else {
    var error = new Error(response.statusText)
    error.response = response
    throw error
  }
}

export const parseJSON = (response) => response.json()

const makeRequest = (url, opts) => {
  const newOpts = { ...opts }
  const accessToken = getAccessToken()
  if (accessToken) {
    newOpts.headers = new Headers({'Authorization': accessToken})
  }

  const request = new Request(url, newOpts)

  return fetch(request).then(handleResponse(request))
}

export const get = (url) => makeRequest(url, { method: 'GET' })

export const post = (url, data) => makeRequest(url, { method: 'POST', body: JSON.stringify(data) })
