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
import Login from './components/utilities/Login';
const DOMPurify = require ( 'dompurify' )( window );

function App() {

  const [dimScreen, setDimScreen] = useState( false );
  const footer = '<b>docr.js</b> is &copy; Simplexable.is, LLC, ' + moment().format( 'YYYY') + ', all rights reserved worldwide';
  const jwt = localStorage.getItem( "docr.token" );
  const [menu, showMenu] = useState( false );
  const ref = useRef( null );
  const [showModal, setShowModal] = useState( false );

  const handleClose = () => showMenu( false );
  const hideConfirmationModal = () => setShowModal();
  const interceptEnterKey = (event) => {  if (event.key === 'Enter') event.preventDefault(); };
  
  const onLogout= () => {
    
    localStorage.removeItem( 'docr.token' );
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
            
            <div><b>docr menu</b></div>
          
          </Offcanvas.Title>

        </Offcanvas.Header>

        <Offcanvas.Body>          

          <Nav className="flex-column">

            <Nav.Item className="size-80"><b>issues</b></Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/issues/new"
              >
                new issue
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/issues/list"
              >
                show issues
              </Nav.Link>
            </Nav.Item>
            
            <Nav.Item className="size-80"><b>components</b></Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/components/register"
              >
                new component
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/components/list"
              >
                show components
              </Nav.Link>
            </Nav.Item>

            <Nav.Item className="size-80"><b>functions</b></Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/functions/register"
              >
                new function
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/functions/list"
              >
                show functions
              </Nav.Link>
            </Nav.Item>
            
            <Nav.Item className="size-80"><b>routes</b></Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/routes/register"
              >
                new route
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/routes/list"
              >
                show routes
              </Nav.Link>
            </Nav.Item>

            <Nav.Item className="size-80"><b>utilities</b></Nav.Item>

            <Nav.Item>
              <div className="ml-1 mt-2 size-65">errors</div>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/utilities/errors/new"
              >
                new error
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/utilities/errors/list"
              >
                show defined errors
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <div className="ml-1 mt-2 size-65">parameters</div>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/utilities/globals/search"
              >
                show globals
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                as={Link} 
                onClick={handleClose}
                to="/utilities/parameters/search"
              >
                show parameters
              </Nav.Link>
            </Nav.Item>

            {level > 6 && (

              <>

                <Nav.Item>
                  <div className="ml-1 mt-2 size-65">platforms</div>
                </Nav.Item>

                <Nav.Item>
                  <Nav.Link
                    as={Link} 
                    onClick={handleClose}
                    to="/utilities/platforms/list"
                  >
                    all platforms
                  </Nav.Link>
                </Nav.Item>

                <Nav.Item>
                  <Nav.Link
                    as={Link} 
                    onClick={handleClose}
                    to="/utilities/platforms/new"
                  >
                    new platform
                  </Nav.Link>
                </Nav.Item>

              </>

            )}

            {level >= 7 && (

              <>

                <Nav.Item>
                  <div className="ml-1 mt-2 size-65">users</div>
                </Nav.Item>

                <Nav.Item>
                  <Nav.Link
                    as={Link} 
                    onClick={handleClose}
                    to="/utilities/users/new"
                  >
                    new user
                  </Nav.Link>
                </Nav.Item>

                <Nav.Item>
                  <Nav.Link
                    as={Link} 
                    onClick={handleClose}
                    to="/utilities/users/list"
                  >
                    show users
                  </Nav.Link>
                </Nav.Item>

              </>

            )}

            <Nav.Item>
              <div className="ml-1 mt-2 size-65">other</div>
            </Nav.Item>

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