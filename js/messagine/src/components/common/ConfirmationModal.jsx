import { 
  Button,
  Modal 
} from 'react-bootstrap';

const ConfirmationModal = ({ showModal, hideModal, confirmModal, payload, message }) => {

  return (

      <Modal 
        show={showModal} 
        onHide={hideModal}
      >

        <Modal.Header closeButton>

          <Modal.Title>Confirmation Required</Modal.Title>
          
        </Modal.Header>

        <Modal.Body>

          <div className="alert alert-danger">{message}</div>

        </Modal.Body>

        <Modal.Footer>

          <Button 
            variant="default" 
            onClick={hideModal}
          >
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={ () => confirmModal( payload ) }
          >
            Confirm
          </Button>

        </Modal.Footer>

    </Modal>

  )
  
}

export default ConfirmationModal;