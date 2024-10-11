import {
  useEffect,
  useState
} from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Joi from 'joi';
import { joiResolver } from '@hookform/resolvers/joi';
import moment from 'moment';
import { toast } from 'react-toastify';
import { 
  Container,
  Form,
  OverlayTrigger,
  Row,
  Tooltip
} from 'react-bootstrap';
import { PlusSquare } from '@phosphor-icons/react';
import DeleteConfirmationModal from '../common/DeleteConfirmationModal';
import ErrorBoundary from '../common/ErrorBoundary';
import FormButtons from '../common/FormButtons';
import Loading from '../common/Loading';
import NewDynamicValue from './NewDynamicValue';
import TextArea from '../common/TextArea';
import TextInput from '../common/TextInput';
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';

function DynamicValuesComponent({ 
  dynamicValues,
  handleError,
  loadCampaignData,
  messageId
}) {

  const nowRunning = 'DynamicValues.jsx';  
  
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
    showDynamic: null,
    showModal: false,
    showNew: false
  });

  const { 
    loaded,
    showDynamic,
    showModal,
    showNew
  } = state;

  const schema = Joi.object({
    newValue: Joi.string().required(),
    target: Joi.string().required()
  });

  const { 
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    trigger
  } = useForm({ resolver: joiResolver(schema) });

  const hideConfirmationModal = () => { 

    setState((prevState) => ({
      ...prevState,
      showModal: false
    })); 

  };

  const onDelete = async () => {

    const context = `${nowRunning}.onDelete`;

    try {

      hideConfirmationModal();
      const api = 'campaigns/dynamic/delete';
      const payload = { dynamicId: showDynamic };
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

      await loadCampaignData();
      toast.success('The dynamic value was removed.');

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

    const selectedDynamic = dynamicValues[Object.keys(dynamicValues).find(key => dynamicValues[key][showDynamic])];
    setValue('newValue', selectedDynamic[showDynamic].newValue);
    setValue('target', selectedDynamic[showDynamic].targetName);
    trigger(); // Validate the form.

  };

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`;
    const loadingMessage = 'updating the dynamic value...';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'campaigns/dynamic/update';
      const payload = { 
        ...data,
        dynamicId: showDynamic
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
      toast.success('The dynamic value was updated.');
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

  const showDynamicValue = (dynamicId) => {

    const showDynamic = dynamicId === state.showDynamic ? null : dynamicId;
    setState((prevState) => ({
      ...prevState,
      showDynamic
    }));

  };

  const toggleNewValue = () => { 

    setState((prevState) => ({
      ...prevState,
      showNew: !prevState.showNew
    }));
    
  };

  // Dynamically set the new values when showDynamic changes so the form can be pre-populated and validated.

  useEffect(() => {

    if (showDynamic !== null) {

      const selectedDynamic = dynamicValues[Object.keys(dynamicValues).find(key => dynamicValues[key][showDynamic])];

      if (selectedDynamic) {

        setValue('newValue', selectedDynamic[showDynamic].newValue);
        setValue('target', selectedDynamic[showDynamic].targetName);
        trigger(); // Validate the form.

      }

    }

  }, [dynamicValues, setValue, showDynamic, trigger]);
  

  useEffect(() => {

    const context = `${nowRunning}.useEffect`;

    const runThis = async () => {
    
      if (!loaded) {

        try {

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

  }, [handleError, loaded, trigger, userId]);

  try {

    const dynamicsCount = Object.keys(dynamicValues).length;

    return ( 
    
      <>

        {!loaded && (<Loading className="loading" message="loading associated dynamic values..." />)}

        {loaded && dynamicsCount > 0 && (

          <div className="mt-3 mb-3">

            <h5 className="floats">

              <div className="float-right ml-05">
                <OverlayTrigger
                  delay={{ hide: 100, show: 200 }}
                  overlay={(props) => (
                    <Tooltip {...props}>add a new dynamic value</Tooltip>
                  )}
                  placement="bottom"
                >
                  <div onClick={ () => toggleNewValue()}><PlusSquare /></div>
                </OverlayTrigger>
              </div>
              
              dynamic values ({dynamicsCount})
              
            </h5>

            {showNew && (
              
              <NewDynamicValue 
                loadCampaignData={loadCampaignData}
                messageId={messageId} 
              />

            )}

            {Object.entries(dynamicValues).map(row => {

              const valueName = row[0];

              return (

                <div 
                  className="bg-light p-3"
                  key={valueName}
                >
                  
                  <div className="size-80 mb-2"><b>{valueName}</b></div>

                  <Container className="border-gray-2 size-80">

                    {Object.entries(row[1]).map((innerRow, index) => {

                      const dynamicId = innerRow[0];
                      const {
                        locked,
                        newValue,
                        updated,
                        updatedBy
                      } = innerRow[1];
                      const disabled = +locked < level;

                      return (

                        <Row 
                          className="alternate-1 p-3"
                          key={dynamicId}
                        > 

                          <div
                            className="hover" 
                            onClick={() => showDynamicValue(dynamicId)}
                          >

                            <div className="size-80">content</div>

                            <div
                              className="formatted-content"
                              dangerouslySetInnerHTML={{ __html: newValue }}
                            ></div>

                            <div className="size-80">last updated {moment(updated).format('YYYY.MM.DD')} by {updatedBy}</div>

                          </div>

                          {showDynamic === dynamicId && (

                              <Form 
                                className="bg-light p-3 mt-3 mb-3"
                                onSubmit={handleSubmit( onSubmit)}
                              >
                                
                                <TextInput
                                  disabled={disabled}
                                  errors={errors.target}
                                  inputName="target"
                                  label="target text"
                                  onChange={onChange}
                                  placeholder="the target text cannot be empty"
                                  register={register}
                                />

                                <TextArea
                                  disabled={disabled}
                                  errors={errors.newValue}
                                  inputName="newValue"
                                  label="content"
                                  onChange={onChange}
                                  placeholder="the content cannot be empty..."
                                  register={register}
                                />

                                <FormButtons
                                  deletePrompt="remove this dynamic value"
                                  disabled={disabled}
                                  errors={errors}
                                  onReset={onReset}
                                  showConfirmationModal={showConfirmationModal}
                                  showDelete={true}
                                  submitText="update the dynamic content"
                                />

                              </Form>

                          )}

                        </Row>

                      );

                    })}

                  </Container>                  

                  <DeleteConfirmationModal 
                    confirmModal={onDelete}
                    hideModal={hideConfirmationModal}
                    message="Are you sure you want to remove this dynamic value?"
                    showModal={showModal} 
                  />

                </div>
              );

            })}

          </div>
            
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

export default function DynamicValues(props) {

  const defaultProps = {
    ...props,
    defaultError: "The dynamic values manager isn't working right now.",
    errorNumber: 74
  };

  return (

    <ErrorBoundary
      context="DynamicValues.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <DynamicValuesComponent {...defaultProps} />
    </ErrorBoundary>

  );

}
