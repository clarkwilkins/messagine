import { 
  Alert, 
  Container 
} from 'react-bootstrap';
import { Info } from '@phosphor-icons/react';
const DOMPurify = require ( 'dompurify' )( window );

function InfoAlert( props ) {

  let { message } = props;

  return (

    <Container>

      <Alert className="size-65 p-3 mt-2 mb-2">
        
        <Info /> <span dangerouslySetInnerHTML={{__html: DOMPurify.sanitize( message ) }}></span>

      </Alert>

    </Container>

  );

}

export default InfoAlert;