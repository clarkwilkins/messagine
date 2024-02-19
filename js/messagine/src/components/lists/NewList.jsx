import { 
  useEffect,
  useState
} from 'react'
import { useOutletContext } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Joi from 'joi'
import { joiResolver } from '@hookform/resolvers/joi'
import { 
  Breadcrumb,
  Form,
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap'
import { List } from '@phosphor-icons/react'
import FormButtons from '../common/FormButtons'
import TextArea from '../common/TextArea'
import TextInput from '../common/TextInput'
import { 
  apiLoader, 
  changeTitle,
  errorDisplay
} from '../../services/handler'

function NewList() {

  const nowRunning = 'lists/NewList.jsx'
  changeTitle ('messagine: new list')

  const defaultError = "The new list tool isn't working right now"
  const [errorState, setErrorState] = useState({
    alreadyReported: false,
    context: '',
    details: 'general exception thrown',
    displayed: 52, // this is only useful when there are child components
    message: defaultError,
    number: 52,
    occurred: false,
  })
  const {
    level,
    toggleDimmer
  } = useOutletContext()
  const schema = Joi.object({
    apiTesting: Joi.boolean().optional(),
    listName: Joi.string().required(),
    listNotes: Joi.string().optional().allow('', null)
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
      const api = 'lists/new'
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

      window.location ='./manage'

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

export default NewList