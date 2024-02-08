import { 
  Alert, 
  Container 
} from 'react-bootstrap';
import { Warning as WarningIcon } from '@phosphor-icons/react';
const DOMPurify = require ( 'dompurify' )( window );

function Warning( props ) {

  let { 
    className,
    message 
  } = props;

  return (

    <Container className={className}>

      <Alert 
        className="size-65 p-3"
        variant="danger">
        
        <WarningIcon /> <span dangerouslySetInnerHTML={{__html: DOMPurify.sanitize( message ) }}></span>

      </Alert>

    </Container>

  );

}

export default Warning;