import {
  useEffect,
  useState
} from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Joi from 'joi';
import { joiResolver } from '@hookform/resolvers/joi';
import { toast } from 'react-toastify';
import { Form } from 'react-bootstrap';
import CheckBoxInput from '../common/CheckBoxInput';
import ErrorBoundary from '../common/ErrorBoundary';
import FormButtons from '../common/FormButtons';
import Loading from '../common/Loading';
import TextArea from '../common/TextArea';
import TextInput from '../common/TextInput';
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';

function NewDynamicValueComponent({ 
  handleError,
  loadCampaignData,
  messageId
}) {

  const nowRunning = 'NewDynamicValue.jsx';
  
  
  const {
    setLoadingMessages,
    userId
  } = useOutletContext();

  const { 
    addLoadingMessage, 
    removeLoadingMessage 
  } = useLoadingMessages(setLoadingMessages);

  const [state, setState] = useState({
    loaded: false
  });

  const { loaded } = state;

  const schema = Joi.object({
    locked: Joi.boolean().required(),
    newValue: Joi.string().required(),
    target: Joi.string().required()
  });

  const { 
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    trigger
  } = useForm({ resolver: joiResolver(schema) });

  const onChange = () => { trigger(); }

  const onReset = () => {

    reset();
    setValue('locked', false);
    trigger();

  };

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`;
    const loadingMessage = 'creating the new dynamic value...';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'campaigns/dynamic/new';
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

      await loadCampaignData();
      toast.success('The dynamic value was added.');
      onReset();
      removeLoadingMessage(loadingMessage);

    } catch(error) {

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
    
      if (!loaded) {

        try {

          setValue('locked', false);

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

  }, [handleError, loaded, setValue, trigger, userId]);

  try {

    return ( 
    
      <>

        {!loaded && (<Loading className="loading" message="loading the new dynamic value tool..." />)}

        {loaded && (

          <Form 
            className="bg-light p-3 mb-3"
            onSubmit={handleSubmit( onSubmit)}
          >

            <p className="size-65"><b>new dynamic value</b></p>

            <TextInput
              errors={errors.target}
              inputName="target"
              label="target text"
              onChange={onChange}
              placeholder="the target cannot be empty"
              register={register}
            />

            <TextArea
              errors={errors.newValue}
              inputName="newValue"
              label="dynamic text"
              onChange={onChange}
              placeholder="the dynamic text cannot be empty..."
              register={register}
            />

            <div className="size-65 text-muted">options</div>

            <div className="floats">

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
              submitText="add the dynamic value"
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

export default function NewDynamicValue(props) {

  const defaultProps = {
    ...props,
    defaultError: "The new dynamic value tool isn't working right now.",
    errorNumber: 73
  };

  return (

    <ErrorBoundary
      context="NewDynamicValue.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <NewDynamicValueComponent {...defaultProps} />
    </ErrorBoundary>

  );

}