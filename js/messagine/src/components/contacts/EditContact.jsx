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
import FormButtons from '../common/FormButtons'
import TextArea from '../common/TextArea'
import TextInput from '../common/TextInput'
import { 
  apiLoader,
  stringCleaner
} from '../../services/handler'

function EditContact(props) {

  const nowRunning = 'contacts/EditContact.jsx'

  const {
    contact,
    contactId,
    loadContacts,
    setEdit,
    updateErrorState
  } = props
  const defaultError = "The contact editor isn't working right now"
  const errorNumber = 58
  const {
    level,
    toggleDimmer
  } = useOutletContext()
  const [loading, setLoading] = useState()
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

    } catch(e) {

      if (+level === 9) console.log(`exception: ${e.message}`)

      toggleDimmer(false)
      updateErrorState({
        alreadyReported: false,
        details: e.message,
        context,
        errorNumber,
        message: defaultError,
        occurred: true
      })

    }

  }, [contact, level, setValue, trigger, toggleDimmer, updateErrorState])

  // Update the contact data and refresh the parent.

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`

    try {

      toggleDimmer(true)
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

        if (+level === 9) console.log(`failure: ${failure}`)

        toggleDimmer(false)
        updateErrorState({
          alreadyReported: false,
          context,
          errorNumber,
          message: `failure: ${failure}`,
          occurred: true
        })
        return null

      }

      toggleDimmer(false)
      toast.success('The contact was updated.')
      await loadContacts() // Refresh.

    } catch(e) {

      if (+level === 9) console.log(`exception: ${e.message}`)

      toggleDimmer(false)
      updateErrorState({
        alreadyReported: false,
        details: e.message,
        context,
        errorNumber,
        message: defaultError,
        occurred: true
      })

    }

  }
  
  // Only runs once at load.

  useEffect( () => {

    const context = `${nowRunning}.useEffect`

    const runThis = async () => {
    
      if (!loading) {

        setLoading(true) // only do this once! 

        try {

          onReset()

        } catch(e) { // reporting an exception within the function

          if (+level === 9) console.log(`exception: ${e.message}`)

          updateErrorState({
            alreadyReported: false,
            details: e.message,
            context,
            errorNumber,
            message: defaultError,
            occurred: true
          })

        }

        trigger()

      }

    }

    runThis()

  }, [level, loading, onReset, toggleDimmer, trigger, updateErrorState])

  try {

    // final setup before rendering

    if (+level === 9 && Object.keys(errors).length > 0) console.log('validation errors: ', errors)

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
                  close editpr
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

            <Form.Label className="size-65 text-muted">contact options</Form.Label>

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

  } catch(e) {

    if (+level === 9) console.log(`exception: ${e.message}`)

    toggleDimmer(false)
    updateErrorState({
      alreadyReported: false,
      details: e.message,
      context: nowRunning,
      errorNumber,
      message: defaultError,
      occurred: true
    })

  }

}

export default EditContact