import React from 'react';
import { 
  Modal, 
  Spinner 
} from 'react-bootstrap';

function LoadingModal({ loadingMessages }) {

  // console.log('LoadingModal:', loadingMessages);
  
  return (

    <Modal show={loadingMessages.length > 0} centered>

      <Modal.Body className="text-center">

        <Spinner animation="border" role="status" />

        {loadingMessages.map((message, index) => { return <p key={index}>{message}</p> })}

      </Modal.Body>

    </Modal>

  );
}

export default LoadingModal;