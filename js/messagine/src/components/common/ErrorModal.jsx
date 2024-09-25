import { useState } from 'react';
import { Modal } from 'react-bootstrap';
import {  WarningCircle } from '@phosphor-icons/react';

const ErrorModal = ({ errorNumber, errorMessage, noReport }) => { 

  const [showModal, setShowModal] = useState( true );
  const hideModal = () => {
    
    setShowModal( false );
    window.location.reload();

  }

  return (

      <Modal 
        show={showModal} 
        onHide={hideModal}
      >

        <Modal.Header closeButton>

          <Modal.Title><WarningCircle /> error {errorNumber} occurred</Modal.Title>
          
        </Modal.Header>

        <Modal.Body>

          <div className="alert alert-danger size-80">
            
            <p><b>{errorMessage}.</b></p>
            
            {!noReport && ( <p>Uniti support has already been notified of the problem. If you have any questions or would like to provide more details, please contact us at <tt>support@simplexable.com</tt>.</p> )}
            
          </div>

        </Modal.Body>

    </Modal>

  )
  
}

export default ErrorModal;