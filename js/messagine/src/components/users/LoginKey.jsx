import { useEffect } from 'react';
import { 
  useNavigate,
  useParams 
} from 'react-router-dom';
import ErrorBoundary from '../common/ErrorBoundary';
import Loading from '../common/Loading';
import apiLoader from '../../services/apiLoader';
import { 
  changeTitle,
  validateUUID
} from '../../services/utils';

function LoginWithKeyComponent({ handleError }) {

  const nowRunning = 'users/LoginKey.jsx';
  changeTitle('messagine: key-based login');

  const userId = process.env.REACT_APP_API_KEY;
  
  let { key } = useParams();
  const navigate = useNavigate();

  useEffect(() => {

    const context = `${nowRunning}.useEffect`;

    const runThis = async () => {

      try {

        const api = 'users/login-key';
        const payload = { key };
        const { data } = await apiLoader({ api, payload, userId }); // userId is bypassing the record check so you can log in.
        const { 
          failure, 
          success,
          userRecord
        } = data;

        if (!success) {

          handleError({
            failure,
            nowRunning: context,
            userId
          });
          return; 

        }

        const { token } = userRecord;

        // Validate userId.

        if (!validateUUID(userId)) {

          window.alert('The supplied key failed to login. You are being rerouted to the standard login now.');
          navigate('/login');
          return;

        }

        // Proceed with successful login.

        localStorage.setItem("messagine.token", token);
        navigate('/');

      } catch (error) {

        console.error(error);
        handleError({
          error,
          nowRunning: context,
          userId
        });

      }

    };

    runThis();
    
  }, [handleError, key, navigate, userId]);

  return <Loading className="loading" message="loading the login key tool..." />;

}

export default function LoginWithKey(props) {

  const defaultProps = {
    ...props,
    defaultError: "The key-based login tool isn't working right now.",
    errorNumber: 49
  };

  return (

    <ErrorBoundary
      context="users/LoginWithKey.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <LoginWithKeyComponent {...defaultProps} />
    </ErrorBoundary>
  );

}