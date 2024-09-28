import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Joi from 'joi';
import { joiResolver } from '@hookform/resolvers/joi';
import { 
  Col,
  Form,
  Row
} from 'react-bootstrap';
import { Info } from '@phosphor-icons/react';
import ErrorBoundary from '../common/ErrorBoundary';
import FormButtons from '../common/FormButtons';
import TextInput from '../common/TextInput';
import apiLoader from '../../services/apiLoader';
import { changeTitle } from '../../services/utils';

function LoginComponent({ handleError }) {

  const nowRunning = 'utilities/Login.jsx';
  changeTitle('messagine:login');

  const userId = process.env.REACT_APP_API_KEY;

  const schema = Joi.object({ 
    email: Joi.string().required().email({ tlds: { allow: false } }),
    passphrase: Joi.string()
      .required()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
      .message('Password must contain at least 1 uppercase character, 1 lowercase character, and 1 number'),
  });

  const { 
    formState: { errors },
    handleSubmit, 
    register,
    trigger: triggerValidation
  } = useForm({ resolver: joiResolver(schema) });  

  const navigate = useNavigate();

  const onChange = () => { triggerValidation(); };

  const onSubmit = async (data) => {

    const context = `${nowRunning}.onSubmit`;

    try {

      const api = 'users/login-standard';
      const payload = data;
      const { data: login } = await apiLoader({ api, payload });
      const {
        failure,
        success,
        token
      } = login;
      
      if (success !== true && failure !== 'invalid email' && failure !== 'invalid password') {

        localStorage.removeItem('messagine.token');
        handleError({
          failure,
          nowRunning: context,
          userId
        });          

      }

      // Getting parameters we need to store from the userRecord

      localStorage.setItem('messagine.token', token);
      navigate('/');

    } catch (error) {
  
      handleError({
        error,
        nowRunning: context,
        userId
      });
    
    }

  };

  useEffect(() => {

    triggerValidation();

  }, [triggerValidation]);
  
  try {

    return (

      <>

        <h5>login</h5>

        <div className="mt-5 mb-3 size-80">

          <p><Info /> You need to login to <b>messagine.js</b> to gain access. These fields are <u>case-sensitive</u>.</p>
          
          <p><Info /> If you need to reset your password, enter your registered email address first to enable the <strong>Reset password</strong> button. Then check for an email with your reset code. <strong>No code will be sent if your address is not registered. The password reset form is only shown after you click the Reset password button.</strong></p>

        </div>
        
        <Form 
          className="bg-light p-3 mb-3"
          onSubmit={handleSubmit(onSubmit)}    
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
                errors={errors.passphrase}
                inputName="passphrase"
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
                submitText="login to messagine.js"
              />
            </div>

          </div>

        </Form>

      </>

   );

  } catch (error) {
  
    handleError({
      error,
      nowRunning,
      userId
    });

  }

}

export default function Login(props) {

  const defaultProps = {
    ...props,
    defaultError: "The user login tool isn't working right now.",
    errorNumber: 48
  };

  return (

    <ErrorBoundary
      context="users/Login.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <LoginComponent {...defaultProps} />
    </ErrorBoundary>

  );

}
