import { 
  Alert, 
  Container 
} from 'react-bootstrap';
import { Warning } from '@phosphor-icons/react';

function LevelWarning( props ) {

  let { minimum } = props;

  return (

    <Container>

      <Alert variant="danger">
        
        <Warning /> your account is not allowed access to this tool. You need to ask a manager to update you to
        level {minimum} or higher.

      </Alert>

    </Container>

  );

}

export default LevelWarning;
