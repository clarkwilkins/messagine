import { 
  useEffect, 
  useState 
} from 'react';
import { useForm } from 'react-hook-form';
import Joi from 'joi';
import { joiResolver } from '@hookform/resolvers/joi';
import { 
  Col,
  Form,
  Row
} from 'react-bootstrap';
import { Info } from '@phosphor-icons/react';
import FormButtons from '../common/FormButtons';
// import ResetPassword from './ResetPassword';
import TextInput from '../common/TextInput';
import { 
  apiLoader, 
  changeTitle,
  errorDisplay
} from '../../services/handler';

function Login() {

  const nowRunning = 'utilities/Login.jsx';
  changeTitle( 'docr:login' );
  
  const defaultError = "The login tool isn't working right now";
  const [error, setError] = useState();
  const [errorAlreadyReported, setErrorAlreadyReported] = useState( false );
  const [errorContext, setErrorContext] = useState( nowRunning + '.e' );
  const [errorContextReported, setErrorContextReported] = useState();
  const [errorDetails, setErrorDetails] = useState( 'general exception thrown' );
  const [errorDisplayed, setErrorDisplayed] = useState(); // latch the error unless it changes
  const [errorMessage, setErrorMessage] = useState( defaultError );
  const errorNumber = 81;
  const [errorOccurred, setErrorOccurred] = useState( false ); 

  const schema = Joi.object( { 
    email: Joi.string().required().email( { tlds: { allow: false } } ),
    passPhrase: Joi.string()
      .required()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
      .message('Password must contain at least 1 uppercase character, 1 lowercase character, and 1 number'),
  } );
  const { 
    formState: { errors },
    handleSubmit, 
    register,
    trigger: triggerValidation
 
  } = useForm( { resolver: joiResolver( schema ) } );  

  const onChange = () => { triggerValidation(); }

  const onSubmit = async data => {

    try {

      const api = 'utilities/users/login';
      const payload = data;
      const { data: login } = await apiLoader ( api, payload );
      const {
        failure,
        success,
        token
      } = login;
      
      if ( success !== true && failure !== 'invalid email' ) {

        localStorage.removeItem( 'docr.userRecord' );
        setErrorAlreadyReported( true );
        setErrorContext( nowRunning + '.onSubmit.(getting user record)' );
        setErrorMessage( defaultError );
        setErrorOccurred( true );
        return null;
      
      } else if ( failure === 'invalid email' ) {

        localStorage.removeItem( 'docr.userRecord' );
        setErrorAlreadyReported( true );
        setErrorContext( nowRunning + '.onSubmit.(bad login credentials)' );
        setErrorMessage( 'The email and/or password is not correct. Remember passwords are case-sensitive' );
        setErrorOccurred( true );
        return null;

      };

      // getting parameters we need to store from the userRecord

      localStorage.setItem( 'docr.token', token );
      window.location = '/';

    } catch ( e ) {
  
      setError( e );
      setErrorAlreadyReported( false );
      setErrorContext( nowRunning + '.onSubmit.(general exception)' );
      setErrorDetails( 'exception thrown' );
      setErrorMessage( defaultError );
      setErrorOccurred( true );
    
    }

  }

  useEffect( () => {

    triggerValidation();

  }, [triggerValidation] );

  if ( errorOccurred ) {

    let reportError = true;

    if ( errorNumber === errorDisplayed || errorContext === errorContextReported || errorAlreadyReported ) { 
          
      reportError = false; 
        
    } else { 
          
      setErrorContextReported( errorContext );
      setErrorDisplayed( errorNumber ); 
        
    }
        
    return errorDisplay({
      context: errorContext,
      details: errorDetails,
      error, 
      errorMessage,
      errorNumber,
      level: 0,
      nowRunning,
      reportError
    });

    
  }

  try {

    return (

      <>

        <h5>login</h5>

        <div className="mt-5 mb-3 size-80">

          <p><Info /> You need to login to <b>messagine.js</b> to gain access. These fields are <u>case-sensitive</u>.</p>
          
          <p><Info /> If you need to reset your password, enter your registered email address first to enable the <strong>Reset password</strong> button. Then check for an email with your reset code. <strong>No  code will be sent if your address is not registered. The password reset form is only shown after you click the Reset password button.</strong></p>

        </div>
        
        <Form 
          className="bg-light p-3 mb-3"
          onSubmit={handleSubmit( onSubmit )}    
        >

          <Row>

            <Col xs={12} sm={6}>

              <TextInput
                errors={errors.mail}
                inputName="email"
                label="email"
                onChange={onChange}
                placeholder="enter your registered email address..."
                register={register}
              />

            </Col>

            <Col xs={12} sm={6}>

              <TextInput
                errors={errors.passPhrase}
                inputName="passPhrase"
                label="password"
                onChange={onChange}
                placeholder="enter your password..."
                register={register}
                type="password"
                validationText="min 8 characters, 1+ upper & lowercase, 1+ numbers"
              />

            </Col>

          </Row>

          <div className="floats">

            <div className="float-left mr-1">

              <FormButtons
                errors={errors}
                noReset={true}
                submitText="login to docr.js"
              />

            </div>

          </div>

        </Form>

      </>

    );

  } catch( e ) {

    let reportError = true;

    if ( errorNumber === errorDisplayed || errorContext !== errorContextReported ) {

      reportError = false;

    } else {

      setErrorContextReported( errorContext );
      setErrorDisplayed( errorNumber );

    }

    setErrorDisplayed( errorNumber );
    return errorDisplay({
      context: errorContext,
      error: e,
      errorMessage,
      errorNumber,
      level: 0,
      nowRunning,
      reportError
    });

  }

}

export default Login;