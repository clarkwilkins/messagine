import {
  useCallback,
  useEffect,
  useRef,
  useState 
} from 'react';
import { 
  Outlet 
} from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import moment from 'moment';
import { List } from '@phosphor-icons/react';
import 'react-toastify/dist/ReactToastify.css';
import './assets/vendor/bootstrap/css/bootstrap.min.css';
import './assets/css/style.css';
import ConfirmationModal from './components/common/ConfirmationModal';
import LoadingModal from './components/app/loadingModal';
import Login from './components/users/Login';
import { 
  decodeToken, 
  getToken, 
  removeToken 
} from './components/app/tokenService';

import OffCanvasMenu from './components/app/offCanvasMenu'; // Import the new component
const DOMPurify = require('dompurify')(window);

function App() {

  const [state, setState] = useState({
    isLoading: true, // Is App.js still loading?
    isLoggedIn: false,
    level: 0, // The user's access level.
    loadingMessages: ['standby while the app loads...'], // Messages to show in the loading modal.
    menu: false,
    showModal: false,
    userId: null
  });
  const {
    isLoading,
    isLoggedIn,
    level,
    loadingMessages,
    menu,
    showModal,
    userId
  } = state;

  const footer = `<b>messagine.js</b> is &copy; Simplexable.is, LLC, ${moment().format('YYYY')}, all rights reserved worldwide`;
  const ref = useRef(null);

  const handleClose = useCallback(() => setState(prevState => ({ ...prevState, menu: false })), []);
  const hideConfirmationModal = useCallback(() => setState(prevState => ({ ...prevState, showModal: false })), []);
  const interceptEnterKey = (event) => { if (event.key === 'Enter') event.preventDefault(); };

  const onLogout = useCallback(() => {

    removeToken();
    window.location = '/';

  }, []);

  const getUserRecord = useCallback(() => {

    const token = getToken();
    const decoded = decodeToken(token);
  
    if (decoded?.userRecord?.active) {

      setState(prevState => ({
        ...prevState,
        isLoggedIn: true,
        level: +decoded.userRecord.level,
        userId: decoded.userRecord.user_id
      }));

    }
    
    return decoded?.userRecord || null;

  }, []);

  useEffect(() => {

    const runThis = async () => {

      const userRecord = getUserRecord(); // Call getUserRecord to check if the user is logged in.

      if (!userRecord) return; // If there's no user record, exit early.

      // If user is logged in, update loading state and messages.

      setState(prevState => ({
        ...prevState,
        isLoading: false,
        loadingMessages: prevState.loadingMessages.filter(msg => msg !== 'standby while the app loads...')
      }));

    };

    runThis();

  }, [getUserRecord]);

  // useEffect(() => {
    
  //   console.log('Updated loadingMessages:', state.loadingMessages);

  // }, [state.loadingMessages]);

  if (!isLoggedIn) return <Login />;

  return (

    <div>

      <div className="header floats">
        <div onClick={ () => setState(prevState => ({ ...prevState, menu: true })) }><List /></div>        
      </div>

      <OffCanvasMenu 
        menu={menu} 
        handleClose={handleClose} 
        setShowModal={(val) => setState(prevState => ({ ...prevState, showModal: val }))} 
      />

      <div 
        className="content"
        ref={ref}
      >
        <Outlet context={{ 
          level, 
          interceptEnterKey, 
          setLoadingMessages: (updateFunc) => {
            setState(prevState => {
              const safePrevMessages = Array.isArray(prevState.loadingMessages) ? prevState.loadingMessages : [];
              return { 
                ...prevState, 
                loadingMessages: updateFunc(safePrevMessages) 
              };
            });
          },   
          userId: userId
        }} />
      </div>

      <LoadingModal 
        loadingMessages={loadingMessages} 
        show={isLoading}
      />

      <ToastContainer 
        position="bottom-center"
        pauseOnFocusLoss={false}
        newestOnTop
        autoClose={2000}
      />

      <div 
        className="footer"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(footer) }}>
      </div>

      <ConfirmationModal 
        confirmModal={onLogout} 
        hideModal={hideConfirmationModal} 
        message="Please confirm you want to logout?" 
        showModal={showModal} 
      />

    </div>

 );

}

export default App;