import {
  useCallback,
  useEffect,
  useState
} from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Joi from 'joi';
import { joiResolver } from '@hookform/resolvers/joi';
import { toast } from 'react-toastify';
import { 
  Container,
  Form,
  Row
} from 'react-bootstrap';
import CheckBoxInput from '../common/CheckBoxInput';
import ErrorBoundary from '../common/ErrorBoundary';
import FormButtons from '../common/FormButtons';
import Loading from '../common/Loading';
import TextArea from '../common/TextArea';
import TextInput from '../common/TextInput';
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';

function NewMessageComponent({ 
  campaignId,
  existingMessages,
  handleError,
  loadCampaign
}) {

  const nowRunning = 'NewMessage.jsx';
  
  const {
    setLoadingMessages,
    userId
  } = useOutletContext();

  const { 
    addLoadingMessage, 
    removeLoadingMessage 
  } = useLoadingMessages(setLoadingMessages);

  const [state, setState] = useState({
    availableMessages: {},
    currentMessageCount: 0, // How many messages are currently in the campaign?
    loaded: false,
  });

  const { 
    availableMessages,
    currentMessageCount,
    loaded, 
  } = state;

  const schema = Joi.object({
    active: Joi.boolean().required(),
    locked: Joi.boolean().optional(),
    messageContent: Joi.string().required(),
    messageName: Joi.string().required(),
    messageNotes: Joi.string().optional().allow('', null),
    messageSubject: Joi.string().required(),
    repeatable: Joi.boolean().required()
  })

  const { 
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    trigger
  } = useForm({ resolver: joiResolver(schema) });

  const linkMessageToCampaign = async (messageId) => {

    const context = `${nowRunning}.linkMessageToCampaign`;
    const loadingMessage = 'adding the message to the campaign...';

    try {

      const api = 'campaigns/messages/add';
      const payload = {
        campaignId,
        messageId
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

      await loadCampaign(); // Reload the campaign to show the new message.
      delete availableMessages[messageId]; // This message is no longer available now that it's in the campaign.
      setState((prevState) => ({
        ...prevState,
        availableMessages
      }));  
      toast.success('The message was added to your campaign.');
      removeLoadingMessage(loadingMessage);

    } catch(error) {

      handleError({
        error,
        nowRunning: context,
        userId
      });

    }

  };

  const loadAvailableMessages = useCallback(async () => {

    const context = `${nowRunning}.loadAvailableMessages`;

    try {

      addLoadingMessage('loading available messages...');
      const api = 'templates/all';
      const payload = {};
      const { data } = await apiLoader({ api, payload });
      const {
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

      // Filter out messages that are already in the campaign.

      Object.entries(messages).forEach(row => {

        if (existingMessages[row[0]]) {

          delete messages[row[0]];

        }

      });

      setState((prevState) => ({
        ...prevState,
        availableMessages: messages
      }));  

      removeLoadingMessage('loading available messages...');
      
    } catch(error) {

      handleError({
        error,
        nowRunning: context,
        userId
      });

    } 

  }, [addLoadingMessage, existingMessages, handleError, removeLoadingMessage, userId]);

  const onChange = () => { trigger(); }

  const onReset = () => { 
    
    reset();
    setValue('active', true);
    setValue('locked', false);
    setValue('repeatable', false);
    trigger();
  
  }

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`;
    const loadingMessage = 'adding the message...';

    try {

      addLoadingMessage(loadingMessage);

      // Part 1: create the new message.

      let api = 'templates/new';
      let payload = { 
        ...data
      };
      const { data: result } = await apiLoader({ api, payload });
      const {
        failure,
        messageId,
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

      // Part 2: add the message to the campaign.

      api = 'campaigns/messages/add';
      payload = {
        campaignId,
        messageId
      };  
      
      const { data: result2 } = await apiLoader({ api, payload });
      const {
        failure: failure2,
        success: success2
      } = result2;

      if (!success2) {

        handleError({
          error: failure2,
          nowRunning: context,
          userId
        });
        return null;

      }

      toast.success('The message was created and added to your campaign.');
      await loadCampaign(); // Reload the campaign to show the new message.
      removeLoadingMessage(loadingMessage);

    } catch(error) {

      console.error(error);
      handleError({
        error,
        nowRunning: context,
        userId
      });

    }

  };

  useEffect(() => {

    const context = `${nowRunning}.useEffect`;

    const runThis = async () => {

      try {
    
        if (!loaded) { // Initial setup.

          setState((prevState) => ({
            ...prevState,
            loaded: true
          }));
          await loadAvailableMessages();
          setValue('active', true);
          setValue('locked', false);
          setValue('repeatable', false);
          trigger();

        } else if (currentMessageCount !== Object.keys(existingMessages).length) { // Refresh after a message change.

          await loadAvailableMessages();
          setState((prevState) => ({
            ...prevState,
            currentMessageCount: Object.keys(existingMessages).length
          }));

        }

      } catch(error) {

        handleError({
          error,
          nowRunning: context,
          userId
        });

      }

      trigger();

    };

    runThis();

  }, [currentMessageCount, existingMessages, handleError, loaded, loadAvailableMessages, trigger, userId, setValue]);

  const availableMessagesCount = Object.keys(availableMessages).length;

  try {

    return ( 
    
      <>

        {!loaded && (<Loading className="loading" message="loading the new message tool..." />)}

        {loaded && (
          
          <Form 
            className="bg-light p-3 mb-3"
            onSubmit={handleSubmit( onSubmit)}
          >

            <div className="size-65 mb-3"><b>available messages ({availableMessagesCount})</b></div>

            {availableMessagesCount > 0 && (

              <Container className="size-80 border-gray-2 mt-3 mb-3">

                {Object.entries(availableMessages).map(row => {

                  const messageId = row[0];
                  const {
                    messageName,
                    notes,
                    subject
                  } = row[1];


                  return (

                    <Row 
                      className="alternate-1 p-3 hover"
                      key={messageId}
                      onClick={() => linkMessageToCampaign(messageId)}
                    >

                        <div>{messageName}</div>
                        <div className="size-80">subject: {subject}</div>

                        {notes && (<div className="size-65 text-muted">notes: {notes}</div>)}

                    </Row>

                  );


                })}
              
              </Container>

            )}

            <div className="size-65 mb-3"><b>create a new message</b></div>

            <TextInput
              errors={errors.messageName}
              inputName="messageName"
              label="name"
              onChange={onChange}
              placeholder="add the message name here..."
              register={register}
            />

            <TextInput
              errors={errors.messageSubject}
              inputName="messageSubject"
              label="subject
              
              "
              onChange={onChange}
              placeholder="add the message subject here..."
              register={register}
            />

            <TextArea
              errors={errors.messageContent}
              inputName="messageContent"
              label="content"
              onChange={onChange}
              placeholder="add message content here..."
              register={register}
            />

            <TextArea
              inputName="messageNotes"
              label="notes"
              placeholder="optional notes about the message..."
              register={register}
            />

            <div className="size-65 text-muted">options</div>

            <div className="floats">

              <div className="float-left mr-05">

                <CheckBoxInput
                  inputName="active"
                  label="active"
                  register={register}
                />

              </div>

              <div className="float-left mr-05">

                <CheckBoxInput
                  inputName="repeatable"
                  label="repeatable"
                  register={register}
                />

              </div>

              <div className="float-left mr-05">

                <CheckBoxInput
                  inputName="locked"
                  label="locked"
                  register={register}
                />

              </div>

            </div>

            <FormButtons
              errors={errors}
              onReset={onReset}
              submitText="add the message"
            />

          </Form>

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

export default function NewMessage(props) {

  const defaultProps = {
    ...props,
    defaultError: "The new message tool isn't working right now.",
    errorNumber: 68
  };

  return (

    <ErrorBoundary
      context="NewMessage.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <NewMessageComponent {...defaultProps} />
    </ErrorBoundary>

  );

}