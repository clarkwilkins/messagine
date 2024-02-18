import { 
  useRef,
  useState 
} from 'react';
import { 
  Link,
  Outlet 
} from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { jwtDecode } from "jwt-decode";
import moment from 'moment';
import {
  Nav,
  Offcanvas
} from 'react-bootstrap';
import { 
  List
} from '@phosphor-icons/react';
import 'react-toastify/dist/ReactToastify.css';
import './assets/vendor/bootstrap/css/bootstrap.min.css';
import './assets/css/style.css';
import ConfirmationModal from './components/common/ConfirmationModal';
import Login from './components/users/Login';
const DOMPurify = require ( 'dompurify' )( window );

function App() {

  const [dimScreen, setDimScreen] = useState( false );
  const footer = '<b>messagine.js</b> is &copy; Simplexable.is, LLC, ' + moment().format( 'YYYY') + ', all rights reserved worldwide';
  const jwt = localStorage.getItem( "messagine.token" );
  const [menu, showMenu] = useState( false );
  const ref = useRef( null );
  const [showModal, setShowModal] = useState( false );

  const handleClose = () => showMenu( false );
  const hideConfirmationModal = () => setShowModal();
  const interceptEnterKey = (event) => {  if (event.key === 'Enter') event.preventDefault(); };
  
  const onLogout= () => {
    
    localStorage.removeItem( 'messagine.token' );
    window.location = '/';

  }

  const toggleDimmer = setting => { setDimScreen( setting ); }

  if ( !jwt ) return ( <Login /> ); // no user or expired token
  
  const { userRecord } = jwtDecode( jwt );

  if ( !userRecord?.active ) return ( <Login /> ); // not a valid user record

  const {
    level,
    user_id: userId
  } = userRecord;

  return (

    <div className={`${ dimScreen ? "dimmed" : "" }`}>

      <div className="header floats">

        <div onClick={ () => showMenu( true ) }><List /></div>        

      </div>

      <Offcanvas show={menu} onHide={handleClose}>

        <Offcanvas.Header closeButton>

          <Offcanvas.Title>
            
            <div><b>messagine tools</b></div>
          
          </Offcanvas.Title>

        </Offcanvas.Header>

        <Offcanvas.Body>          

          <Nav className="flex-column">

            <Nav.Item className="size-80"><b>message scheduler</b></Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/scheduler/upcoming"
              >
                upcoming events
              </Nav.Link>
            </Nav.Item>

            <Nav.Item className="size-80"><b>contacts</b></Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/contacts/manage"
              >
                manage contacts
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/contacts/new"
              >
                new contact
              </Nav.Link>
            </Nav.Item>

            <Nav.Item className="size-80"><b>mailing lists</b></Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/lists/manage"
              >
                manage lists
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/lists/new"
              >
                new list
              </Nav.Link>
            </Nav.Item>

            <Nav.Item className="size-80"><b>other</b></Nav.Item>

            <Nav.Item>
              <Nav.Link onClick={ () => { setShowModal( true ); } } >
                logout
              </Nav.Link>
            </Nav.Item>

          </Nav>

        </Offcanvas.Body>

      </Offcanvas>

      <div 
        className="content"
        ref={ref}
      >

        <Outlet context={ { 
          level, 
          interceptEnterKey,      
          toggleDimmer,
          userId
        } } />

      </div>

      <ToastContainer 
        position="bottom-center"
        pauseOnFocusLoss={false}
        newestOnTop
        autoClose={2000}
      />

      <div 
        className="footer"
        dangerouslySetInnerHTML={{__html: DOMPurify.sanitize( footer ) }}></div>

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