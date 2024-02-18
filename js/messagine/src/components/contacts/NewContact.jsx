import { 
  useEffect,
  useState
} from 'react'
import { useOutletContext } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Joi from 'joi'
import { joiResolver } from '@hookform/resolvers/joi'
import { toast } from 'react-toastify'
import { 
  Breadcrumb,
  Col,
  Form,
  OverlayTrigger,
  Row,
  Tooltip
} from 'react-bootstrap'
import { List } from '@phosphor-icons/react'
import CheckBoxInput from '../common/CheckBoxInput'
import FormButtons from '../common/FormButtons'
import TextArea from '../common/TextArea'
import TextInput from '../common/TextInput'
import { 
  apiLoader, 
  changeTitle,
  errorDisplay
} from '../../services/handler'

function NewContact() {

  const nowRunning = 'contacts/NewContact.jsx'
  changeTitle ('messagine: new contact')

  const defaultError = "The new contact tool isn't working right now"
  const [errorState, setErrorState] = useState({
    alreadyReported: false,
    context: '',
    details: 'general exception thrown',
    displayed: 57, // this is only useful when there are child components
    message: defaultError,
    number: 57,
    occurred: false,
  })
  const {
    level,
    toggleDimmer
  } = useOutletContext()
  const schema = Joi.object({
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
    register,
    reset,
    trigger
  } = useForm({ resolver: joiResolver(schema)})

  const onReset = () => {
    
    reset()
    trigger()

  }

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`

    try {

      toggleDimmer(true)
      const api = 'contacts/new'
      const payload = { ...data }
      const { data: result } = await apiLoader({ api, payload })
      const {
        failure,
        success
      } = result
      
      if (!success) {

        if (+level === 9) console.log(`failure: ${failure}`)
    
        toggleDimmer(false)
        setErrorState(prevState => ({
          ...prevState,
          alreadyReported: true,
          context,
          message: `failure: ${failure}`,
          occurred: true
        }))
        return null
    
      }

      toast.success('The new contact was created.')
      onReset()

    } catch(e) {

      if (+level === 9) console.log(`exception: ${e.message}`)

      toggleDimmer(false)
      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        alreadyReported: false,
        occurred: true
      }))

    }

  }

  // we need form validation at load time

  useEffect(() => { trigger() }, [trigger])

  try {
    
    // setup for error display and (possible) reporting

    let reportError = false // default condition is there is no error
    const {
      alreadyReported,
      context,
      details,
      message: errorMessage,
      errorNumber,
      occurred: errorOccurred
    } = errorState

    if (errorOccurred && !alreadyReported) reportError = true // persist this error to the Simplexable API

    // final setup before rendering

    if (+level === 9 && Object.keys(errors).length > 0) console.log('validation errors: ', errors)

    return (
    
      <>

        {errorOccurred && (

          errorDisplay({
            context,
            details,
            errorMessage,
            errorNumber,
            nowRunning,
            reportError
          })

      )}
          
        <>

          <Breadcrumb className="size-50 text-muted mb-3">

            <Breadcrumb.Item>contacts</Breadcrumb.Item>
            <Breadcrumb.Item>new</Breadcrumb.Item>

          </Breadcrumb>

          <h5 className="floats">

            <div className="float-right ml-05">

              <OverlayTrigger
                delay={ {  hide: 100, show: 200 } }
                overlay={ (props) => (
                  <Tooltip { ...props }>
                    show contacts
                  </Tooltip>
             )}
                placement="bottom"
              >

                <a href="./manage"><List /></a>
                
              </OverlayTrigger>
              
            </div>
            
            new contact

          </h5>

          <Form 
            className="bg-light p-3 mb-3"
            onSubmit={handleSubmit(onSubmit)}
          >

            <Row>

              <Col xs={12} sm={6}>

                <TextInput
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
                  inputName="companyName"
                  label="company name"
                  placeholder="company name is optional"
                  register={register}
                />

              </Col>

              <Col xs={12} sm={6}>

                <TextInput
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
                  inputName="sms"
                  label="sms"
                  placeholder="sms is optional"
                  register={register}
                />

              </Col>

              <Col xs={12} sm={6}>

                <TextInput
                  inputName="url"
                  label="sms"
                  placeholder="url is optional"
                  register={register}
                />

              </Col>
              
              <Col xs={12} sm={6}>

                <Form.Label className="size-65 text-muted">contact options</Form.Label>

                <div className="mt-3">

                  <CheckBoxInput
                    inputName="locked"
                    label="locked"
                    register={register}
                  />

                </div>

              </Col>

            </Row>

            <TextArea
                inputName="contactNotes"
                label="notes"
                placeholder="use this to add notes about the contact..."
                register={register}
            />

            

          <FormButtons
            errors={errors}
            onReset={onReset}
            submitText="create the contact"
          />

          </Form>

        </>

      </>

)

  } catch(e) {

    if (+level === 9) console.log(`exception: ${e.message}`)

    toggleDimmer(false)
    setErrorState(prevState => ({
      ...prevState,
      context: nowRunning,
      details: e.message,
      errorAlreadyReported: false,
      occurred: true
    }))

  }

}

export default NewContact