import { 
  useCallback,
  useEffect,
  useState
} from 'react'
import { useOutletContext } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Joi from 'joi'
import { joiResolver } from '@hookform/resolvers/joi'
import { toast } from 'react-toastify'
import { 
  Col,
  Form,
  OverlayTrigger,
  Row,
  Tooltip
} from 'react-bootstrap'
import { XCircle } from '@phosphor-icons/react'
import CheckBoxInput from '../common/CheckBoxInput'
import ErrorBoundary from '../common/ErrorBoundary';
import FormButtons from '../common/FormButtons'
import TextArea from '../common/TextArea'
import TextInput from '../common/TextInput'
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';
import { stringCleaner } from '../../services/utils';

function EditContactComponent(props) {

  const nowRunning = 'contacts/EditContact.jsx'

  const {
    contact,
    contactId,
    handleError,
    loadContacts,
    setEdit
  } = props
  const {
    level,
    setLoadingMessages,
    userId
  } = useOutletContext()

  const [state, setState] = useState({
    loaded: false
  });

  const { loaded } = state;

  const { 
    addLoadingMessage, 
    removeLoadingMessage 
  } = useLoadingMessages(setLoadingMessages);

  const schema = Joi.object({
    active: Joi.boolean().optional(),
    blockAll: Joi.boolean().optional(),
    companyName: Joi.string().optional().allow( '', null ),
    contactName: Joi.string().required(),
    contactNotes: Joi.string().optional().allow( '', null ),
    email: Joi.string().required(),
    locked: Joi.boolean(),
    sms: Joi.string().optional().allow( '', null ),
    url: Joi.string().optional().allow( '', null )
  })

  const { 
    formState: { errors },
    handleSubmit,
    setValue,
    register,
    trigger
  } = useForm({ resolver: joiResolver(schema)})

  // onReset reloads the original contact values.

  const onReset = useCallback(() => {
    
    const context = `${nowRunning}.onReset`

    try {

      const {
        active,
        blockAll,
        companyName,
        contactName,
        contactNotes,
        email,
        locked,
        sms
      } = contact
      setValue('active', active)
      setValue('blockAll', blockAll)
      setValue('companyName', companyName)
      setValue('contactName', contactName)
      setValue('contactNotes', contactNotes)
      setValue('email', email)
      setValue('sms', sms)

      if (+locked >= +level) setValue('locked', true)

      trigger()

    } catch(error) {

      handleError({ 
        error,
        nowRunning: context,
        userId
      });

    }

  }, [contact, handleError, level, trigger, userId, setValue])

  // Update the contact data and refresh the parent.

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`
    const loadingMessage = 'Updating the contact...'

    try {

      addLoadingMessage(loadingMessage)
      const {
        active,
        blockAll,
        companyName,
        contactName, 
        contactNotes,
        email,
        locked,
        sms,
        url
      } = data
      const api = 'contacts/update'
      const payload = { 
        active,
        blockAll,
        companyName: stringCleaner(companyName, true),
        contactId,
        contactName: stringCleaner(contactName, true),
        contactNotes: stringCleaner(contactNotes, true),
        email: stringCleaner(email, true),
        locked,
        sms: stringCleaner(sms, true),
        url: stringCleaner(url, true),
      }
      const { data: result } = await apiLoader({ api, payload })
      const {
        failure,
        success
      } = result
      
      if (!success) {

        handleError({
          failure,
          nowRunning: context,
          userId
        });
        return null;

      }

      toast.success('The contact was updated.')
      await loadContacts();
      removeLoadingMessage(loadingMessage)

    } catch(error) {

      handleError({
        error,
        nowRunning: context,
        userId
      });

    }

  }
  
  // Only runs once at load.

  useEffect( () => {

    const context = `${nowRunning}.useEffect`

    const runThis = async () => {

      try {

        if (!loaded) {

          onReset();
          setState((prevState) => ({
            ...prevState,
            loaded: true
          }));

        }

        trigger()

      } catch(error) {
          
        handleError({
          error,
          nowRunning: context,
          userId
        });

      }

    }

    runThis();

  }, [handleError, loaded, onReset, trigger, userId])

  try {

    // Final setup before rendering.

    let disabled = false

    if (+level < +contact.locked) disabled = true

    return (
          
      <Form 
        className="bg-light p-3 mt-3 mb-3"
        onSubmit={handleSubmit(onSubmit)}
      >

        <div className="floats">

          <div className="float-right ml-05">

            <OverlayTrigger
              delay={ {  hide: 100, show: 200 } }
              overlay={ (props) => (
                <Tooltip { ...props }>
                  close editor
                </Tooltip>
            )}
              placement="bottom"
            >

              <div onClick={ () => setEdit() }><XCircle /></div>
              
            </OverlayTrigger>

          </div>

        </div>

        <Row>

          <Col xs={12} sm={6}>

            <TextInput
              disabled={disabled}
              errors={errors.contactName}
              inputName="contactName"
              label="contact name"
              onChange={ () => trigger() }
              placeholder="contact name cannot be empty"
              register={register}
            />

          </Col>

          <Col xs={12} sm={6}>

            <TextInput
              disabled={disabled}
              inputName="companyName"
              label="company name"
              placeholder="company name is optional"
              register={register}
            />

          </Col>

          <Col xs={12} sm={6}>

            <TextInput
              disabled={disabled}
              errors={errors.email}
              inputName="email"
              label="email"
              onChange={ () => trigger() }
              placeholder="email address cannot be empty"
              register={register}
            />

          </Col>

          <Col xs={12} sm={6}>

            <TextInput
              disabled={disabled}
              inputName="sms"
              label="sms"
              placeholder="sms is optional"
              register={register}
            />

          </Col>

          <Col xs={12} sm={6}>

            <TextInput
              disabled={disabled}
              inputName="url"
              label="sms"
              placeholder="url is optional"
              register={register}
            />

          </Col>
          
          <Col xs={12} sm={6}>

            <div className="size-65 text-muted">contact options</div>

            <div className="mt-3 floats">

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
                  inputName="blockAll"
                  label="block all"
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

            </div>

          </Col>

        </Row>

        <TextArea
          disabled={disabled}
          inputName="contactNotes"
          label="notes"
          placeholder="use this to add notes about the contact..."
          register={register}
        />

        

      <FormButtons
        disabled={disabled}
        errors={errors}
        onReset={onReset}
        submitText="update the contact"
      />

      </Form>

    )

  } catch(error) {

    handleError({
      error,
      nowRunning,
      userId
    })

  }

}

export default function EditContact(props) {

  const defaultProps = {
    ...props,
    defaultError: "The contact editor isn't working right now.",
    errorNumber: 58
  };

  return (

    <ErrorBoundary
      context="EditContact.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <EditContactComponent {...defaultProps} />
    </ErrorBoundary>

  )

}
