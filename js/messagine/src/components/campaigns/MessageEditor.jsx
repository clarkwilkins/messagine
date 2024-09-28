import {
  useCallback,
  useEffect,
  useState
} from 'react';
import { 
  useNavigate,
  useOutletContext,
  useParams
} from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Joi from 'joi';
import { joiResolver } from '@hookform/resolvers/joi';
import { toast } from 'react-toastify';
import { 
  Breadcrumb,
  Form,
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap';
import { List } from '@phosphor-icons/react';
import CheckBoxInput from '../common/CheckBoxInput';
import DeleteConfirmationModal from '../common/DeleteConfirmationModal';
import ErrorBoundary from '../common/ErrorBoundary';
import FormButtons from '../common/FormButtons';
import Loading from '../common/Loading';
import TextArea from '../common/TextArea';
import TextInput from '../common/TextInput';
import Warning from '../common/Warning';
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';
import { changeTitle } from '../../services/utils';

function MessageEditorComponent({ handleError }) {

  const nowRunning = 'campaigns/MessageEditor.jsx';
  changeTitle('messagine: edit campaign message');

  const {
    campaignId,
    messageId
  } = useParams();
  
  const {
    level,
    setLoadingMessages,
    userId
  } = useOutletContext();

  const { 
    addLoadingMessage, 
    removeLoadingMessage 
  } = useLoadingMessages(setLoadingMessages);

  const [state, setState] = useState({
    loaded: false,
    message: {},
    showModal: false
  });

  const { 
    loaded, 
    message, 
    showModal 
  } = state;

  const schema = Joi.object({
    active: Joi.boolean().required(),
    content: Joi.string().required(),
    front: Joi.boolean().required(),
    locked: Joi.boolean().required(),
    messageName: Joi.string().required(),
    notes: Joi.string().required().allow('', null),
    repeatable: Joi.boolean().required(),
    subject: Joi.string().required()
  });

  const { 
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    trigger
  } = useForm({ resolver: joiResolver(schema) });

  const navigate = useNavigate();

  const hideConfirmationModal = () => { 

    setState((prevState) => ({
      ...prevState,
      showModal: false
    })); 

  };

  const loadCampaignData = useCallback(async () => {

    const context = `${nowRunning}.loadCampaignData`;
    const loadingMessage = `loading campaign data for campaignId ${campaignId}`;

    try {

      addLoadingMessage(loadingMessage);
      const api = 'campaigns/load';
      const payload = { campaignId };
      const { data } = await apiLoader({ api, payload });

      const {
        campaignName,
        failure,
        messages,
        success
      } = data;

      if (!success) {
        handleError({
          error: failure,
          nowRunning: context,
          userId
        });
        return null;
      }

      messages[messageId].campaignName = campaignName; // this is used as a display element below
      setState((prevState) => ({
        ...prevState,
        message: messages[messageId]
      }));      
      removeLoadingMessage(loadingMessage);
      return messages[messageId];

    } catch(error) {

      handleError({
        error,
        nowRunning: context,
        userId
      });
  
    }

  }, [addLoadingMessage, campaignId, handleError, messageId, userId, removeLoadingMessage]);

  const loadForm = useCallback(message => {

    const context = `${nowRunning}.loadForm`;

    try {

      let {
        active,
        content,
        locked,
        messageName,
        notes,
        repeatable,
        subject
      } = message;

      if (+locked >= +level) { locked = true } else { locked = false }

      setValue('active', active);
      setValue('content', content);
      setValue('front', false);
      setValue('messageName', messageName);
      setValue('locked', locked);
      setValue('notes', notes);
      setValue('repeatable', repeatable);
      setValue('subject', subject);

    } catch(e) {

      handleError({
        error: e,
        nowRunning: context,
        userId
      });

    }

  }, [handleError, level, setValue, userId]);

  const onDelete = async () => {

    const context = `${nowRunning}.onDelete`;

    try {

      hideConfirmationModal();
      const api = 'campaigns/messages/remove';
      const payload = {
        campaignId,
        messageId,
        position: message.position
      };
      const { data } = await apiLoader({ api, payload });
      const {
        failure,
        success
      } = data;

      if (!success) {

        handleError({
          error: failure,
          nowRunning: context,
          userId
        });
        return null;

      }

      navigate('/campaigns/manage');

    } catch(e) {

      handleError({
        error: e,
        nowRunning: context,
        userId
      });

    }

  };

  const onReset = () => {

    loadForm(message);
    trigger();

  };

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`;
    const loadingMessage = 'updating the campaign message...';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'campaigns/messages/update';
      const payload = { 
        ...data,
        campaignId,
        messageId
      };
      const { data: result } = await apiLoader({ api, payload });
      const {
        failure,
        success
      } = result;

      if (!success) {

        handleError({
          error: failure,
          nowRunning: context,
          userId
        });
        return null;

      }

      toast.success('The campaign message was updated.');
      removeLoadingMessage(loadingMessage);

    } catch(error) {

      handleError({
        error,
        nowRunning: context,
        userId
      });

    }

  };

  const showConfirmationModal = () => { 

    setState((prevState) => ({
      ...prevState,
      showModal: true
    }));
    
  };

  useEffect(() => {

    const context = `${nowRunning}.useEffect`;

    const runThis = async () => {
    
      if (!loaded) {

        try {

          const message = await loadCampaignData();

          if (message?.messageName) loadForm(message);

          setState((prevState) => ({
            ...prevState,
            loaded: true
          }));

        } catch(error) {

          handleError({
            error,
            nowRunning: context,
            userId
          });

        }

      }

      trigger();

    };

    runThis();

  }, [handleError, loadCampaignData, loadForm, loaded, trigger, userId]);

  try {

    const messageNotFound = `messageId ${messageId} was not located - please ensure you did not change the page parameters`;
    const { 
      campaignName,
      locked 
    } = message;
    const disabled = +locked > +level;

    return ( 
    
      <>

        {!loaded && (<Loading className="loading" message="loading the message editor..." />)}

        {loaded && (
          
          <>

            <Breadcrumb className="size-50 text-muted mb-3">

              <Breadcrumb.Item>campaigns</Breadcrumb.Item>
              <Breadcrumb.Item>edit message</Breadcrumb.Item>

            </Breadcrumb>

            <h5 className="floats">

              <div className="float-right ml-05">

                <OverlayTrigger
                  delay={ {  hide: 100, show: 200 } }
                  overlay={ (props) => (
                    <Tooltip { ...props }>
                      manage campaigns
                    </Tooltip>
                )}
                  placement="bottom"
                >

                  <a href="../../manage"><List /></a>
                  
                </OverlayTrigger>
                
              </div>
              
              edit campaign message

            </h5>

            {!message && (<Warning message={messageNotFound} />)}

            {message && (

              <>

                <Form 
                  className="bg-light p-3 mb-3"
                  onSubmit={handleSubmit( onSubmit)}
                >

                  <div className="size-65 text-muted">campaign</div>

                  <div>{campaignName}</div>

                  <TextInput
                    disabled={disabled}
                    errors={errors.messageName}
                    inputName="messageName"
                    label="message name"
                    onChange={ () => trigger() }
                    placeholder="the message name cannot be empty"
                    register={register}
                  />

                  <TextInput
                    disabled={disabled}
                    errors={errors.subject}
                    inputName="subject"
                    label="subject"
                    onChange={ () => trigger() }
                    placeholder="the message subject cannot be empty"
                    register={register}
                  />

                  <TextArea
                    disabled={disabled}
                    inputName="content"
                    label="content"
                    placeholder="the content of the message cannot be empty..."
                    register={register}
                  />

                  <TextArea
                    disabled={disabled}
                    inputName="notes"
                    label="notes"
                    placeholder="use this to add notes about the message..."
                    register={register}
                  />

                  <div className="size-65 text-muted">message options</div>

                  <div className="floats">

                    <div className="float-left mr-05">

                      <CheckBoxInput
                        disabled={ locked > level }
                        inputName="active"
                        label="active"
                        register={register}
                      />

                    </div>

                    <div className="float-left mr-05">

                      <CheckBoxInput
                        disabled={ locked > level }
                        inputName="repeatable"
                        label="repeatable"
                        register={register}
                      />

                    </div>

                    <div className="float-left mr-05">

                      <CheckBoxInput
                        disabled={ locked > level }
                        inputName="locked"
                        label="locked"
                        register={register}
                      />

                    </div>

                    <div className="float-left mr-05">

                      <CheckBoxInput
                        disabled={ locked > level }
                        inputName="front"
                        label="move to front"
                        register={register}
                      />

                    </div>

                  </div>

                  <FormButtons
                    disabled={disabled}
                    errors={errors}
                    onReset={onReset}
                    showConfirmationModal={showConfirmationModal}
                    showDelete={true}
                    submitText="update the message"
                  />

                </Form>

                <DeleteConfirmationModal 
                  confirmModal={onDelete}
                  hideModal={hideConfirmationModal}
                  message="Are you sure you want to remove this campaign message?"
                  showModal={showModal} 
                />

              </>

            )}

          </>

        )}

      </>

    );

  } catch (error) {

    handleError({ 
      error,
      nowRunning,
      userId
    });

  }

}

export default function MessageEditor(props) {

  const defaultProps = {
    ...props,
    defaultError: "The message editor isn't working right now.",
    errorNumber: 54
  };

  return (

    <ErrorBoundary
      context="MessageEditor.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <MessageEditorComponent {...defaultProps} />
    </ErrorBoundary>

  );

}
