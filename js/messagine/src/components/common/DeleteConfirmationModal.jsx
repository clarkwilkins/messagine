import { 
  Button,
  Modal 
} from 'react-bootstrap';

const DeleteConfirmationModal = ( { showModal, hideModal, confirmModal, deletePayload, message } ) => {

  return (

      <Modal 
        show={showModal} 
        onHide={hideModal}
      >

        <Modal.Header closeButton>

          <Modal.Title>Delete Confirmation</Modal.Title>
          
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
            onClick={ () => confirmModal( deletePayload ) }
          >
            Delete
          </Button>

        </Modal.Footer>

    </Modal>

  )
  
}

export default DeleteConfirmationModal;