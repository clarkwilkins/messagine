import { 
  OverlayTrigger, 
  Tooltip 
} from 'react-bootstrap';
import { Trash } from '@phosphor-icons/react';

function Delete( props ) {

  let { 
    deleteMessage,
    deletePayload,
    deletePrompt,
    setDeleteMessage,
    setDeletePayload,
    showConfirmationModal 
  } = props;

  return (

    <>

      <OverlayTrigger
        delay={ { hide: 100, show: 200 } }
        overlay={ ( props ) => ( 
          <Tooltip { ...props }>
            {deletePrompt}
          </Tooltip>
        ) }
        placement="bottom"
      >

        <span className="ml-05 text-red">

          <Trash onClick={ () => {
            
            if ( deleteMessage && setDeleteMessage ) setDeleteMessage( deleteMessage );

            if ( deletePayload && setDeletePayload ) setDeletePayload( deletePayload );

            showConfirmationModal( true );
          
          } } />

        </span>
        
      </OverlayTrigger>

    </>

  );

}

export default Delete;