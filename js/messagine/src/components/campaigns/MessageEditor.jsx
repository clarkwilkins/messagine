import {
  useCallback,
  useEffect,
  useState
} from 'react'
import { 
  useOutletContext,
  useParams
} from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Joi from 'joi'
import { joiResolver } from '@hookform/resolvers/joi'
import { toast } from 'react-toastify'
import { 
  Breadcrumb,
  Form,
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap'
import { List } from '@phosphor-icons/react'
import CheckBoxInput from '../common/CheckBoxInput'
import DeleteConfirmationModal from '../common/DeleteConfirmationModal'
import FormButtons from '../common/FormButtons'
import Loading from '../common/Loading'
import TextArea from '../common/TextArea'
import TextInput from '../common/TextInput'
import Warning from '../common/Warning'
import { 
  apiLoader, 
  changeTitle,
  errorDisplay
} from '../../services/handler'

function MessageEditor() {

  const nowRunning = 'campaigns/MessageEditor.jsx'
  changeTitle ( 'messagine: edit campaign message')

  const defaultError = "The schedule editor isn't working right now"
  const [errorState, setErrorState] = useState( {
    alreadyReported: false,
    context: '',
    details: 'general exception thrown',
    displayed: 54, // this is only useful when there are child components
    message: defaultError,
    number: 54,
    occurred: false,
  })
  const {
    campaignId,
    messageId
  } = useParams()
  const {
    level,
    toggleDimmer
  } = useOutletContext()
  const [loading, setLoading] = useState()
  const [loaded, setLoaded] = useState()
  const [message, setMessage] = useState({})
  const schema = Joi.object({
    active: Joi.boolean().required(),
    content: Joi.string().required(),
    front: Joi.boolean().required(),
    locked: Joi.boolean().required(),
    messageName: Joi.string().required(),
    notes: Joi.string().required().allow('', null),
    repeatable: Joi.boolean().required(),
    subject: Joi.string().required()
  })
  const [showModal, setDisplayConfirmationModal] = useState(false)

  const { 
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    trigger
  } = useForm( { resolver: joiResolver(schema)})

  const hideConfirmationModal = () => { setDisplayConfirmationModal(false); }

  // the point here is to load this message's campaign specific data as well as the message content data

  const loadCampaignData = useCallback( async () => {

    const context = `${nowRunning}.loadCampaignData`

    try {

      const api = 'campaigns/load'
      const payload = { campaignId }
      const { data } = await apiLoader({ api, payload })

      const {
        campaignName,
        failure,
        messages,
        success
      } = data;
    
      // reporting a failure from the API (already logged)
    
      if (!success) {
    
        if (level === 9) console.log(`failure: ${failure}`)
    
        toggleDimmer(false)
        setErrorState(prevState => ({
          ...prevState,
          context,
          details: `failure: ${failure}`,
          errorAlreadyReported: true,
          message: `failure: ${failure}`, // show the failure message on the modal
          occurred: true
        }))
        // useEffect only: setLoaded(true)
        return null
    
      }

      messages[messageId].campaignName = campaignName // this is used as a display element below
      setMessage(messages[messageId])
      return messages[messageId] // so useEffect gets this without having to wait for state to update

    } catch(e) { // reporting an exception within the function

      if (level === 9) console.log(`exception: ${e.message}`)
    
      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        errorAlreadyReported: false,
        occurred: true
      }))
  
    }

  }, [campaignId, level, messageId, toggleDimmer])

  // (re)load form values

  const loadForm = useCallback( message => {


    const context = `${nowRunning}.onDelete`

    try {

      let {
        active,
        content,
        locked,
        messageName,
        notes,
        repeatable,
        subject
      } = message

      if (+locked >= +level) { locked = true } else { locked = false }

      // load the form with current values

      setValue('active', active)
      setValue('content', content)
      setValue('front', false)
      setValue('messageName', messageName)
      setValue('locked', locked)
      setValue('notes', notes)
      setValue('repeatable', repeatable)
      setValue('subject', subject)

    } catch(e) { // reporting an exception within the function

      if (level === 9) console.log(`exception: ${e.message}`)
    
      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        errorAlreadyReported: false,
        occurred: true
      }))

    }

  }, [level, setValue])

  const onDelete = async () => {

    const context = `${nowRunning}.onDelete`

    try {

      hideConfirmationModal()
      const api = 'campaigns/messages/remove'
      const payload = {
        campaignId,
        messageId,
        position: message.position
      }
      const { data } = await apiLoader({ api, payload })
      const {
        failure,
        success
      } = data;
    
      // reporting a failure from the API (already logged)
    
      if (!success) {
    
        if (level === 9) console.log(`failure: ${failure}`)
    
        toggleDimmer(false)
        setErrorState(prevState => ({
          ...prevState,
          context,
          details: `failure: ${failure}`,
          errorAlreadyReported: true,
          message: `failure: ${failure}`, // show the failure message on the modal
          occurred: true
        }))
        // useEffect only: setLoaded(true)
        return null
    
      }

      window.location = '../../manage' // exit on success, as this record no longer exists

    } catch(e) { // reporting an exception within the function

      if (level === 9) console.log(`exception: ${e.message}`)
    
      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        errorAlreadyReported: false,
        occurred: true
      }))
  
    }

  }

  // reset means reload the form to original condition

  const onReset = () => {
    
    loadForm(message)
    trigger()

  }

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`

    try {

      toggleDimmer( true)
      const api = 'campaigns/messages/update'
      const payload = { 
        ...data,
        campaignId,
        messageId
      }
      const { data: result } = await apiLoader( { api, payload })
      const {
        failure,
        success
      } = result
      
      if ( !success) {

        if ( level === 9) console.log( `failure: ${failure}`)
    
        toggleDimmer( false)
        setErrorState( prevState => ( {
          ...prevState,
          alreadyReported: true,
          context,
          message: `failure: ${failure}`,
          occurred: true
        }))
        return null
    
      }

      toast.success( 'The campaign message was updated.')
      toggleDimmer(false)

    } catch( e) {

      if ( level === 9) console.log( `exception: ${e.message}`)

      toggleDimmer( false)
      setErrorState( prevState => ( {
        ...prevState,
        context,
        details: e.message,
        alreadyReported: false,
        occurred: true
      }))

    }

  }

  const showConfirmationModal = () => { setDisplayConfirmationModal(true); }

  useEffect( () => {

    const context = `${nowRunning}.useEffect`

    const runThis = async () => {
    
      if (!loading) {

        setLoading(true) // only do this once! 

        try {

          toggleDimmer(true)
          const message = await loadCampaignData()
          
          if (message?.messageName) loadForm(message)

          toggleDimmer(false)
          setLoaded(true)

        } catch(e) { // reporting an exception within the function

          if (level === 9) console.log(`exception: ${e.message}`)

          setErrorState(prevState => ({
            ...prevState,
            context,
            details: e.message,
            errorAlreadyReported: false,
            occurred: true
          }))
          setLoaded(true)

        }

      }

      trigger()

    }

    runThis()

  }, [level, loadCampaignData, loading, loadForm, toggleDimmer, trigger])

  try {
    
    // setup for error display and ( possible) reporting

    let reportError = false // default condition is there is no error
    const {
      alreadyReported,
      context,
      details,
      message: errorMessage,
      errorNumber,
      occurred: errorOccurred
    } = errorState

    if ( errorOccurred && !alreadyReported) reportError = true // persist this error to the Simplexable API

    // final setup before rendering

    if (+level === 9 && Object.keys(errors).length > 0) console.log('validation errors: ', errors)

    const messageNotFound = `messageId ${messageId} was not located - please ensure you did not change the page parameters`
    const { 
      campaignName,
      locked 
    } = message
    const disabled = +locked > +level

    return ( 
    
      <>

        {errorOccurred && ( 

          errorDisplay( {
            context,
            details,
            errorMessage,
            errorNumber,
            nowRunning,
            reportError
          })

        )}

        {!loaded && (<Loading className="loading" message="loading the message editor..." />)}

        {loaded && (
          
          <>

            <Breadcrumb className="size-50 text-muted mb-3">

              <Breadcrumb.Item>campaigns</Breadcrumb.Item>
              <Breadcrumb.Item>edit message</Breadcrumb.Item>

            </Breadcrumb>

            <h5 className="floats">

              <div className="float-right ml-05">

                <OverlayTrigger
                  delay={ {  hide: 100, show: 200 } }
                  overlay={ (props) => (
                    <Tooltip { ...props }>
                      manage campaigns
                    </Tooltip>
                )}
                  placement="bottom"
                >

                  <a href="../../manage"><List /></a>
                  
                </OverlayTrigger>
                
              </div>
              
              edit campaign message

            </h5>

            {!message && (<Warning message={messageNotFound} />)}

            {message && (

              <>

                <Form 
                  className="bg-light p-3 mb-3"
                  onSubmit={handleSubmit( onSubmit)}
                >

                  <Form.Label className="size-65 text-muted">campaign</Form.Label>

                  <div>{campaignName}</div>

                  <TextInput
                    disabled={disabled}
                    errors={errors.messageName}
                    inputName="messageName"
                    label="message name"
                    onChange={ () => trigger() }
                    placeholder="the message name cannot be empty"
                    register={register}
                  />

                  <TextInput
                    disabled={disabled}
                    errors={errors.subject}
                    inputName="subject"
                    label="subject"
                    onChange={ () => trigger() }
                    placeholder="the message subject cannot be empty"
                    register={register}
                  />

                  <TextArea
                    disabled={disabled}
                    inputName="content"
                    label="content"
                    placeholder="the content of the message cannot be empty..."
                    register={register}
                  />

                  <TextArea
                    disabled={disabled}
                    inputName="notes"
                    label="notes"
                    placeholder="use this to add notes about the message..."
                    register={register}
                  />

                  <Form.Label className="size-65 text-muted">message options</Form.Label>

                  <div className="floats">

                    <div className="float-left mr-05">

                      <CheckBoxInput
                        disabled={ locked > level }
                        inputName="active"
                        label="active"
                        register={register}
                      />

                    </div>

                    <div className="float-left mr-05">

                      <CheckBoxInput
                        disabled={ locked > level }
                        inputName="repeatable"
                        label="repeatable"
                        register={register}
                      />

                    </div>

                    <div className="float-left mr-05">

                      <CheckBoxInput
                        disabled={ locked > level }
                        inputName="locked"
                        label="locked"
                        register={register}
                      />

                    </div>

                    <div className="float-left mr-05">

                      <CheckBoxInput
                        disabled={ locked > level }
                        inputName="front"
                        label="move to front"
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
                    submitText="update the message"
                  />

                </Form>

                <DeleteConfirmationModal 
                  confirmModal={onDelete}
                  hideModal={hideConfirmationModal}
                  message="Are you sure you want to remove this campaign message?"
                  showModal={showModal} 
                />

              </>

            )}

          </>

        )}

      </>

    )

  } catch( e) {

    if ( level === 9) console.log( `exception: ${e.message}`)

    toggleDimmer( false)
    setErrorState( prevState => ( {
      ...prevState,
      context: nowRunning,
      details: e.message,
      errorAlreadyReported: false,
      occurred: true
    }))

  }

}

export default MessageEditor