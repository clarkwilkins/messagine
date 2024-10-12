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
import moment from 'moment';
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
import InfoAlert from '../common/InfoAlert';
import Loading from '../common/Loading';
import TextArea from '../common/TextArea';
import TextInput from '../common/TextInput';
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';
import { changeTitle } from '../../services/utils';

function EditTemplateComponent({ handleError }) {

  const nowRunning = 'EditTemplate.jsx';
  changeTitle('messagine: REPLACE');
  
  const { messageId } = useParams();

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
    active: true,
    content: '',
    created: 0,
    loaded: false,
    locked: false,
    messageName: '',
    notes: '',
    owner: '',
    repeatable: false,
    showModal: false,
    subject: '',
    updated: 0,
    updatedBy: '',
    updatedBy2: ''
  });

  const { 
    created,
    loaded,
    locked,
    showModal,
    updated,
    updatedBy2
  } = state;

  const schema = Joi.object({
    active: Joi.boolean().required(),
    locked: Joi.boolean().optional(),
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

  const navigate = useNavigate();

  const hideConfirmationModal = () => { 

    setState((prevState) => ({
      ...prevState,
      showModal: false
    })); 

  };

  const loadTemplate = useCallback(async () => {

    const context = `${nowRunning}.loadTemplate`;

    try {

      addLoadingMessage('loading the template...');
      const api = 'templates/load';
      const payload = { messageId };
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

      delete data.success;  // This is no longer needed.
      const {
        active,
        content: messageContent,
        locked,
        messageName,
        notes,
        repeatable,
        subject,
      } = data;
      console.log('data', data);
      setValue('active', active);
      setValue('locked', locked === level);
      setValue('messageContent', messageContent);
      setValue('messageName', messageName);
      setValue('messageNotes', notes);
      setValue('repeatable', repeatable);
      setValue('messageSubject', subject);
      setState((prevState) => ({
        ...prevState,
        ...data
      }));

      removeLoadingMessage('loading the template...');

    } catch(error) {

      handleError({
        error,
        nowRunning: context,
        userId
      });
    
    }

  }, [addLoadingMessage, handleError, level, messageId, removeLoadingMessage, setValue, userId]);

  const onDelete = async () => {

    const context = `${nowRunning}.onDelete`;

    try {

      hideConfirmationModal();
      const api = 'templates/delete';
      const payload = { messageId };
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

      navigate('/templates/manage');

    } catch(e) {

      handleError({
        error: e,
        nowRunning: context,
        userId
      });

    }

  };

  const onChange = () => { trigger(); }

  const onReset = () => {

    reset();
    trigger();

  };

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`;
    const loadingMessage = 'updating the template...';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'templates/update';
      const payload = { 
        ...data,
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

      toast.success('The template was updated.');
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


        setState((prevState) => ({
          ...prevState,
          loaded: true
        }));
        await loadTemplate();

      }

      trigger();

    }

    runThis().catch(error => {
      
      handleError({
        error,
        nowRunning: context,
        userId
      });

    });

  }, [handleError, loaded, loadTemplate, trigger, userId]);

  try {

    const disabled = +locked > +level;
    const message = `created ${moment.unix(created).format('YYYY.MM.DD')}, last updated ${moment.unix(updated).format('YYYY.MM.DD')} by ${updatedBy2}.`;

    return ( 
    
      <>

        {!loaded && (<Loading className="loading" message="loading the template..." />)}

        {loaded && (
          
          <>

            <Breadcrumb className="size-50 text-muted mb-3">

              <Breadcrumb.Item>templates</Breadcrumb.Item>
              <Breadcrumb.Item>edit</Breadcrumb.Item>

            </Breadcrumb>

            <h5 className="floats">

              <div className="float-right ml-05">

                <OverlayTrigger
                  delay={ {  hide: 100, show: 200 } }
                  overlay={ (props) => (
                    <Tooltip { ...props }>
                      manage & create templates
                    </Tooltip>
                )}
                  placement="bottom"
                >

                  <a href="/templates/manage"><List /></a>
                  
                </OverlayTrigger>
                
              </div>
              
              edit message template

            </h5>

            <>

              <Form 
                className="bg-light p-3 mb-3"
                onSubmit={handleSubmit( onSubmit)}
              >

                <InfoAlert message={message} />

                <TextInput
                  disabled={disabled}
                  errors={errors.messageName}
                  inputName="messageName"
                  label="message name"
                  onChange={onChange}
                  placeholder="the name cannot be empty..."
                  register={register}
                />

                <TextInput
                  disabled={disabled}
                  errors={errors.messageSubject}
                  inputName="messageSubject"
                  label="subject"
                  onChange={onChange}
                  placeholder="the subject cannot be empty..."
                  register={register}
                />

                <TextArea
                  disabled={disabled}
                  errors={errors.messageContent}
                  inputName="messageContent"
                  label="content"
                  placeholder="the content cannot be empty..."
                  register={register}
                />

                <TextArea
                  disabled={disabled}
                  errors={errors.messageNotes}
                  inputName="messageNotes"
                  label="notes"
                  placeholder="optional notes about the message (purpose, usage, etc.)..."
                  register={register}
                />

                <div className="size-65 text-muted">options</div>

                <div className="floats">

                  <div className="float-left mr-05">

                    <CheckBoxInput
                      disabled={disabled}
                      inputName="active"
                      label="active"
                      register={register}
                    />

                  </div>
                  
                  <div className="float-left mr-05">

                    <CheckBoxInput
                      disabled={disabled}
                      inputName="locked"
                      label="locked"
                      register={register}
                    />

                  </div>

                  <div className="float-left mr-05">

                    <CheckBoxInput
                      disabled={disabled}
                      inputName="repeatable"
                      label="repeatable"
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
                  submitText="update the template"
                />

              </Form>

              <DeleteConfirmationModal 
                confirmModal={onDelete}
                hideModal={hideConfirmationModal}
                message="Are you sure you want to remove this template?"
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

export default function EditTemplate(props) {

  const defaultProps = {
    ...props,
    defaultError: "The template editor isn't working right now.",
    errorNumber: 70
  };

  return (

    <ErrorBoundary
      context="EditTemplate.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <EditTemplateComponent {...defaultProps} />
    </ErrorBoundary>

  );

}
