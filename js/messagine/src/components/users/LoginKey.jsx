import { 
  useEffect,
  useState
} from 'react';
import { useParams } from 'react-router-dom';
import Loading from '../common/Loading';
import { 
  apiLoader, 
  changeTitle,
  errorDisplay,
  validateUUID
} from '../../services/handler'


function LoginWithKey() {

  const nowRunning = 'users/LoginKey.jsx'
  changeTitle ('messagine: key-based login')

  const defaultError = "The login tool isn't working right now"
  const [error, setError] = useState()
  const [errorAlreadyReported, setErrorAlreadyReported] = useState(false)
  const [errorContext, setErrorContext] = useState(nowRunning + '.e')
  const [errorContextReported, setErrorContextReported] = useState()
  const [errorDetails, setErrorDetails] = useState('general exception thrown')
  const [errorDisplayed, setErrorDisplayed] = useState() // latch the error unless it changes
  const [errorMessage, setErrorMessage] = useState(defaultError)
  const [errorNumber, setErrorNumber] = useState(49)
  const [errorOccurred, setErrorOccurred] = useState(false)
  let { key } = useParams()

  useEffect(() => {

    const runThis = async () => {

      const api = 'users/login-key'
      const payload = { key }

      try {

        const { data } = await apiLoader({ api, payload })
        
        const { 
          failure, 
          success,
          userRecord
        } = data

        if (!success) {

          const context = nowRunning + '.useEffect'
          setErrorAlreadyReported(true)
          setErrorContext(context)
          setErrorDetails(`failure: ${failure}`)
          setErrorMessage(defaultError)
          setErrorNumber(errorNumber)
          setErrorOccurred(true)
          return null

        }

        // getting parameters we need to store from the userRecord

        const {
          token,
          user_id: userId
        } = userRecord

        // the user record is missing data

        if (!validateUUID(userId)) {

          window.alert ('The supplied key failed to login. You are being rerouted to the standard login now.')
          window.location = '../'
          return null

        } else if (success !== true) {

          localStorage.removeItem('messagine.token')
          window.alert('The login failed: ' + failure + '. Support has been notified.')

        }
        
        // we are ok to proceed with the login

        localStorage.setItem("messagine.token", token)
        window.location = '../'

      } catch (e) {
      
        const context = nowRunning + '.useEffect';      
        setErrorAlreadyReported(false)
        setErrorContext(context + ': exception thrown')
        setErrorDetails(e.message)
        setErrorMessage(defaultError)
        setErrorNumber(errorNumber); 
        setErrorOccurred(true)
      
      }

    }

    runThis()

  }, [errorNumber, key])

  try {
    
    let reportError = false; // default condition is there is no error

    if (errorOccurred && errorNumber !== errorDisplayed && errorContext !== errorContextReported && !errorAlreadyReported) { 
                
      reportError = true; 
      setErrorContextReported(errorContext)
      setErrorDisplayed(errorNumber); 

    }
    
    return (
    
      <>

        {errorOccurred && (

          errorDisplay({
            context: errorContext,
            details: errorDetails,
            error,
            errorMessage,
            errorNumber,
            nowRunning,
            reportError
          })

       )}

        <Loading className="loading" message="loading the login key tool..." />

      </>

   )

  } catch(e) {
  
    setError(e)
    setErrorDisplayed(errorNumber)
    return errorDisplay({
      context: nowRunning, // context is logged as the area that failed
      details: e.message,
      error: e,
      errorMessage: defaultError,
      errorNumber, // also the default
      nowRunning,
      reportError
    })

  }

}

export default LoginWithKey;