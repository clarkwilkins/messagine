import { useEffect } from 'react';
import { 
  useNavigate,
  useOutletContext 
} from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Joi from 'joi';
import { joiResolver } from '@hookform/resolvers/joi';
import { 
  Breadcrumb,
  Form,
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap';
import { List } from '@phosphor-icons/react';
import ErrorBoundary from '../common/ErrorBoundary';
import FormButtons from '../common/FormButtons';
import TextArea from '../common/TextArea';
import TextInput from '../common/TextInput';
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';
import { changeTitle } from '../../services/utils';

function NewListComponent({ handleError }) {

  const nowRunning = 'lists/NewList.jsx';
  changeTitle ('messagine: new list');
  
  const {
    setLoadingMessages,
    userId
  } = useOutletContext();

  const { 
    addLoadingMessage, 
    removeLoadingMessage 
  } = useLoadingMessages(setLoadingMessages);
  
  const schema = Joi.object({
    apiTesting: Joi.boolean().optional(),
    listName: Joi.string().required(),
    listNotes: Joi.string().optional().allow('', null)
  });

  const { 
    formState: { errors },
    handleSubmit,
    register,
    reset,
    trigger
  } = useForm({ resolver: joiResolver(schema)});

  const navigate = useNavigate();

  const onReset = () => {
    
    reset();
    trigger();

  }

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`;
    const loadingMessage = 'creating the list...';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'lists/new';
      const payload = { ...data };
      const { data: result } = await apiLoader({ api, payload });
      const {
        failure,
        success
      } = result;
      
      if (!success) {

        handleError({ 
          failure,
          nowRunning: context, 
          userId
        });
    
      }

      removeLoadingMessage(loadingMessage);
      navigate('/lists/manage');

    } catch(error) {

      handleError({ 
        error,
        nowRunning: context, 
        userId
      });

    }

  }

  // we need form validation at load time

  useEffect(() => { trigger() }, [trigger]);

  try {

    return (
              
      <>

        <Breadcrumb className="size-50 text-muted mb-3">

          <Breadcrumb.Item>lists</Breadcrumb.Item>
          <Breadcrumb.Item>new</Breadcrumb.Item>

        </Breadcrumb>

        <h5 className="floats">

          <div className="float-right ml-05">

            <OverlayTrigger
              delay={ {  hide: 100, show: 200 } }
              overlay={ (props) => (
                <Tooltip { ...props }>
                  show lists
                </Tooltip>
            )}
              placement="bottom"
            >

              <a href="./manage"><List /></a>
              
            </OverlayTrigger>
            
          </div>
          
          new list

        </h5>

        <Form 
          className="bg-light p-3 mb-3"
          onSubmit={handleSubmit(onSubmit)}
        >

          <TextInput
              errors={errors.listName}
              inputName="listName"
              label="list name"
              onChange={ () => trigger() }
              placeholder="the list name cannot be empty"
              register={register}
          />

          <TextArea
              inputName="listNotes"
              label="notes"
              placeholder="use this to add notes about the list..."
              register={register}
          />

        <FormButtons
          errors={errors}
          onReset={onReset}
          submitText="create the list"
        />

        </Form>

      </>

    );

  } catch(error) {

    handleError({ 
      error,
      nowRunning, 
      userId
    });

  }  

}

export default function NewList(props) {

  const defaultProps = {
    ...props,
    defaultError: "The new list tool isn't working right now.",
    errorNumber: 52
  };

  return (

    <ErrorBoundary
      context="lists/NewList.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <NewListComponent {...defaultProps} />
    </ErrorBoundary>

  );

}