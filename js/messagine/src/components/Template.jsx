import {
  useCallback,
  useEffect,
  useState
} from 'react';
import { 
  useNavigate,
  useOutletContext
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

function TEMPLATEComponent({ handleError }) {

  const nowRunning = 'TEMPLATE.jsx';
  changeTitle('messagine: REPLACE');
  
  
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
    showModal: false
  });

  const { 
    loaded, 
    showModal 
  } = state;

  const schema = Joi.object({
    active: Joi.boolean().required()
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

  const onDelete = async () => {

    const context = `${nowRunning}.onDelete`;

    try {

      hideConfirmationModal();
      const api = 'ROUTE/delete';
      const payload = {
        
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

      navigate('/');

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
    const loadingMessage = 'updating the THING...';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'ROUTE/update';
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

      toast.success('The THING was updated.');
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

          // do something

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

    
    const disabled = +locked > +level;

    return ( 
    
      <>

        {!loaded && (<Loading className="loading" message="loading the THING..." />)}

        {loaded && (
          
          <>

            <Breadcrumb className="size-50 text-muted mb-3">

              <Breadcrumb.Item>LEVEL1</Breadcrumb.Item>
              <Breadcrumb.Item>LEVEL2</Breadcrumb.Item>

            </Breadcrumb>

            <h5 className="floats">

              <div className="float-right ml-05">

                <OverlayTrigger
                  delay={ {  hide: 100, show: 200 } }
                  overlay={ (props) => (
                    <Tooltip { ...props }>
                      Something??
                    </Tooltip>
                )}
                  placement="bottom"
                >

                  <a href="../../manage"><List /></a>
                  
                </OverlayTrigger>
                
              </div>
              
              TEMPLATE

            </h5>

            <>

              <Form 
                className="bg-light p-3 mb-3"
                onSubmit={handleSubmit( onSubmit)}
              >

                <TextInput
                  disabled={ locked > level }
                  errors={errors.TEST}
                  inputName="TEST"
                  label="TEST"
                  onChange={onChange}
                  placeholder="the TEST cannot be empty"
                  register={register}
                />

                <TextArea
                  disabled={ locked > level }
                  inputName="TEST"
                  label="TEST"
                  placeholder="the TEST cannot be empty..."
                  register={register}
                />

                <div className="size-65 text-muted">options</div>

                <div className="floats">

                  <div className="float-left mr-05">

                    <CheckBoxInput
                      disabled={ locked > level }
                      inputName="TEST"
                      label="TEST"
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
                  submitText="update the TEST"
                />

              </Form>

              <DeleteConfirmationModal 
                confirmModal={onDelete}
                hideModal={hideConfirmationModal}
                message="Are you sure you want to remove this TEST?"
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

export default function TEMPLATE(props) {

  const defaultProps = {
    ...props,
    defaultError: "The THING isn't working right now.",
    errorNumber: 999
  };

  return (

    <ErrorBoundary
      context="TEMPLATE.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <TEMPLATEComponent {...defaultProps} />
    </ErrorBoundary>

  );

}
