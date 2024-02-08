import { 
  OverlayTrigger, 
  Tooltip 
} from 'react-bootstrap';
import { ArrowCounterClockwise } from '@phosphor-icons/react';

function Reset( props ) {

  let { 
    onReset,
    prompt
  } = props;

  if ( !prompt ) prompt = 'reset the form';

  return (

    <>

      { " " }

      <OverlayTrigger
        delay={ { hide: 100, show: 200 } }
        overlay={ ( props ) => ( 
          <Tooltip { ...props }>{prompt}</Tooltip>
        )}
        placement="bottom"
      >

        <span className="ml-05">

          <ArrowCounterClockwise onClick={ () => { onReset(); } } />

        </span>

      </OverlayTrigger>

    </>

  );

}

export default Reset;