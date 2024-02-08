import { Button } from 'react-bootstrap';
import Delete from './Delete';
import Reset from './Reset';

function FormButtons( props ) {

  let {
    deleteMessage,
    deletePayload,
    deletePrompt,
    disableButtons,
    errors,
    noReset,
    onReset,
    setDeleteMessage,
    setDeletePayload,
    showConfirmationModal,
    showDelete,
    submitText
  } = props;

  if (!errors ) errors = {}; // in case the form is not using validation

  return (

    <div className="mb-2">

      <div className="no-mobile">

        <Button 
          disabled={Object.keys( errors ).length > 0 || disableButtons}
          type="submit"
          variant="primary" 
        >
          {Object.keys( errors ).length > 0 && ( <span>missing required inputs</span> )}
          {Object.keys( errors ).length === 0 && ( <span>{submitText}</span> )}
        </Button>

        {showDelete && !disableButtons && (

          <Delete
            deleteMessage={deleteMessage}
            deletePayload={deletePayload}
            deletePrompt={deletePrompt}
            setDeleteMessage={setDeleteMessage}
            setDeletePayload={setDeletePayload}
            showConfirmationModal={showConfirmationModal}
          />

        )}
        
        {!noReset && ( <Reset onReset = {onReset} /> ) }

      </div>

      <div className="no-desktop">

        <Button 
          className="mb-3 width-99"
          disabled={Object.keys( errors ).length > 0}
          type="submit"
          variant="primary" 
        >
          {Object.keys( errors ).length > 0 && ( <span>missing required inputs</span> )}
          {Object.keys( errors ).length === 0 && ( <span>{submitText}</span> )}
        </Button>

        {showDelete && (

          <Button 
            className="mb-3 width-99"
            onClick={

              () => {

                setDeleteMessage( deleteMessage )
                setDeletePayload( deletePayload )
                showConfirmationModal( true );

              }

            }
            variant="danger" 
            >
            delete this item
          </Button>

        )}

        {!noReset && (

          <Button
            className="width-99"
            onClick={ () => onReset() }
            variant="secondary"
          >
            reset the form
          </Button>

        )}

      </div>

    </div>

  );

}

export default FormButtons;