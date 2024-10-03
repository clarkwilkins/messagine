import { Link } from 'react-router-dom';
import { Nav, Offcanvas } from 'react-bootstrap';

function OffCanvasMenu({ menu, handleClose, setShowModal }) {

  return (
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

          <Nav.Item className="size-80"><b>campaigns</b></Nav.Item>

          <Nav.Item>
            <Nav.Link
              as={Link} 
              onClick={handleClose}
              to="/campaigns/manage"
            >
              manage campaigns
            </Nav.Link>
          </Nav.Item>

          <Nav.Item>
            <Nav.Link
              as={Link} 
              onClick={handleClose}
              to="/campaigns/new"
            >
              new campaign
            </Nav.Link>
          </Nav.Item>

          <Nav.Item className="size-80"><b>message templates</b></Nav.Item>

          <Nav.Item>
            <Nav.Link
              as={Link} 
              onClick={handleClose}
              to="/templates/manage"
            >
              manage templates
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
            <Nav.Link onClick={() => { setShowModal(true); }}>
              logout
            </Nav.Link>
          </Nav.Item>

        </Nav>
      </Offcanvas.Body>
    </Offcanvas>
  );
}

export default OffCanvasMenu;