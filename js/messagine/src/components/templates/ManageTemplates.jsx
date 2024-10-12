import {
  useCallback,
  useEffect,
  useState
} from 'react';
import { 
  Link,
  useOutletContext
} from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Joi from 'joi';
import { joiResolver } from '@hookform/resolvers/joi';
import moment from 'moment';
import { toast } from 'react-toastify';
import { 
  Breadcrumb,
  Container,
  Form,
  OverlayTrigger,
  Row,
  Tooltip
} from 'react-bootstrap';
import { 
  MinusSquare,
  PlusSquare,
  Trash
} from '@phosphor-icons/react';
import CheckBoxInput from '../common/CheckBoxInput';
import DeleteConfirmationModal from '../common/DeleteConfirmationModal';
import ErrorBoundary from '../common/ErrorBoundary';
import FormButtons from '../common/FormButtons';
import InfoAlert from '../common/InfoAlert';
import Loading from '../common/Loading';
import TextArea from '../common/TextArea';
import TextInput from '../common/TextInput';
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';
import { changeTitle } from '../../services/utils';

function ManageTemplatesComponent({ handleError }) {

  const nowRunning = 'ManageTemplates.jsx';
  changeTitle('messagine: message templates');
  
  
  const {
    setLoadingMessages,
    userId
  } = useOutletContext();

  const { 
    addLoadingMessage, 
    removeLoadingMessage 
  } = useLoadingMessages(setLoadingMessages);

  const [state, setState] = useState({
    deleteTarget: null,
    loaded: false,
    messages: {},
    showModal: false,
    showNewTemplate: false
  });

  const { 
    deleteTarget,
    loaded,
    messages,
    showModal ,
    showNewTemplate
  } = state;

  const schema = Joi.object({
    active: Joi.boolean().required(),
    locked: Joi.boolean().required(),
    messageContent: Joi.string().required(),
    messageName: Joi.string().required(),
    messageNotes: Joi.string().optional().allow('', null),
    messageSubject: Joi.string().required(),
    repeatable: Joi.boolean().required(),
  });

  const { 
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    trigger
  } = useForm({ resolver: joiResolver(schema) });

  const hideConfirmationModal = () => { 

    setState((prevState) => ({
      ...prevState,
      showModal: false
    })); 

  };

  const loadTemplates = useCallback(async () => {

    const context = `${nowRunning}.loadTemplates`;

    try {

      const api = 'templates/all';
      const payload = {}
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

      setState((prevState) => ({
        ...prevState,
        messages
      }));

    } catch(error) {

      handleError({
        error,
        nowRunning: context,
        userId
      });

    }

  }, [handleError, userId]);

  const onDelete = async () => {

    const context = `${nowRunning}.onDelete`;
    const loadingMessage = 'removing the message template...';

    try {

      hideConfirmationModal();
      addLoadingMessage(loadingMessage);
      const api = 'templates/delete';
      const payload = { messageId: deleteTarget };
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

      toast.success('The message template was removed.');
      setState((prevState) => ({
        ...prevState,
        loaded: false
      }));
      removeLoadingMessage(loadingMessage);

    } catch(e) {

      handleError({
        error: e,
        nowRunning: context,
        userId
      });

    }

  };

  const onChange = () => { trigger(); }

  const onReset = useCallback(() => {

    reset();
    setValue('active', true);
    setValue('locked', false);
    setValue('repeatable', false);
    trigger();

  }, [reset, setValue, trigger]);

  // Adding a new message template.

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`;
    const loadingMessage = 'adding the message template...';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'templates/new';
      const payload = { 
        ...data
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

      toast.success('The template was added.');
      await loadTemplates(); // Refresh the list of templates
      onReset(); // Clear the form.
      toggleNewTemplate(); // Hide the form.
      removeLoadingMessage(loadingMessage);

    } catch(error) {

      handleError({
        error,
        nowRunning: context,
        userId
      });

    }

  };

  const showConfirmationModal = target => { 

    setState((prevState) => ({
      ...prevState,
      deleteTarget: target,
      showModal: true
    }));
    
  };

  const toggleNewTemplate = () => {

    setState((prevState) => ({
      ...prevState,
      showNewTemplate: !showNewTemplate
    }));

  };

  useEffect(() => {

    const context = `${nowRunning}.useEffect`;

    const runThis = async () => {
    
      if (!loaded) {

        try {

          await loadTemplates();
          onReset(); // Preset the new template form
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

  }, [handleError, loaded, loadTemplates, onReset, trigger, userId]);

  const templateCount = Object.keys(messages).length;

  try {

    return ( 
    
      <>

        {!loaded && (<Loading className="loading" message="loading message templates..." />)}

        {loaded && (
          
          <>

            <Breadcrumb className="size-50 text-muted mb-3">

              <Breadcrumb.Item>templates</Breadcrumb.Item>
              <Breadcrumb.Item>manage</Breadcrumb.Item>

            </Breadcrumb>

            <h5 className="floats">

              <div className="float-right ml-05">

                <OverlayTrigger
                  delay={ {  hide: 100, show: 200 } }
                  overlay={ (props) => (
                    <Tooltip { ...props }>
                      {showNewTemplate ? 'hide' : 'show'} new template form
                    </Tooltip>
                )}
                  placement="bottom"
                >

                  <div onClick={() => toggleNewTemplate()}>
                    {showNewTemplate ? (<MinusSquare/>) : (<PlusSquare/>)}
                  </div>
                  
                </OverlayTrigger>
                
              </div>
              
              manage templates

            </h5>

            <>

              {showNewTemplate && (

                <Form 
                  className="bg-light p-3 mb-3"
                  onSubmit={handleSubmit( onSubmit)}
                >

                  <div className="size-65 mb-2"><b>new template</b></div>

                  <TextInput
                    errors={errors.messageName}
                    inputName="messageName"
                    label="name"
                    onChange={onChange}
                    placeholder="add a name for this message template..."
                    register={register}
                  />
                  
                  <TextInput
                    errors={errors.messageSubject}
                    inputName="messageSubject"
                    label="subject"
                    onChange={onChange}
                    placeholder="add a subject for this message template..."
                    register={register}
                  />

                  <TextArea
                    errors={errors.messageContent}
                    inputName="messageContent"
                    label="content"
                    onChange={onChange}
                    placeholder="add message content or template:reference here..."
                    register={register}
                  />

                  <TextArea
                    inputName="messageNotes"
                    label="content"
                    placeholder="optional notes about the message template..."
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
                        inputName="locked"
                        label="locked"
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

                  </div>

                  <FormButtons
                    errors={errors}
                    onReset={onReset}
                    submitText="add this message"
                  />

                </Form>

              )}

              {templateCount === 0 && (<InfoAlert message="no message templates are defined at this time" />)}

              {templateCount > 0 && (

                <Container className="border-gray-2 mt-3 size-80">

                  {Object.entries(messages).map(row => {

                    const messageId = row[0];
                    const {
                      active,
                      messageName,
                      notes,
                      updated,
                      updatedBy2: updatedBy
                    } = row[1];
                    const link = '/templates/edit/' + messageId;

                    return (

                      <Row
                        className="alternate-1 p-3"
                        key={messageId} 
                      >

                        <Link to={link}>

                          <div>{messageName}{!active && (<span>*</span>)}</div>
                          <div className="size-80">{notes}</div>
                          
                        </Link>

                        <div className="floats">

                          <div
                            className="float-right ml-1 text-red"
                            onClick={() => showConfirmationModal(messageId)}
                          >
                            
                            <OverlayTrigger
                              delay={ {  hide: 100, show: 200 } }
                              overlay={ (props) => (
                                <Tooltip { ...props }>
                                  delete this template
                                </Tooltip>
                            )}
                              placement="bottom"
                            >
                              <Trash />                              
                            </OverlayTrigger>

                          </div>

                          <Link to={link}>
                            <div className="size-80">
                              last updated {moment.unix(updated).format('YYYY.MM.DD')} by {updatedBy}
                            </div>
                          </Link>

                        </div>

                      </Row>

                    );

                  })}

                </Container>

              )}

              <DeleteConfirmationModal 
                confirmModal={onDelete}
                hideModal={hideConfirmationModal}
                message="Are you sure you want to remove this template? Existing campaign messages will not be affected."
                showModal={showModal} 
              />

            </>

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

export default function ManageTemplates(props) {

  const defaultProps = {
    ...props,
    defaultError: "The template manager isn't working right now.",
    errorNumber: 69
  };

  return (

    <ErrorBoundary
      context="ManageTemplates.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <ManageTemplatesComponent {...defaultProps} />
    </ErrorBoundary>

  );

}
