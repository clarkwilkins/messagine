import {
  useEffect,
  useState
} from 'react';
import { 
  useNavigate,
  useOutletContext
} from 'react-router-dom';
import { 
  Controller,
  useForm 
} from 'react-hook-form';
import Joi from 'joi';
import { joiResolver } from '@hookform/resolvers/joi';
import moment from 'moment';
import { toast } from 'react-toastify';
import { 
  Breadcrumb,
  Col,
  Form,
  OverlayTrigger,
  Row,
  Tooltip
} from 'react-bootstrap';
import { List } from '@phosphor-icons/react';
import CheckBoxInput from '../common/CheckBoxInput';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import ErrorBoundary from '../common/ErrorBoundary';
import FormButtons from '../common/FormButtons';
import Loading from '../common/Loading';
import RequiredField from '../common/RequiredField';
import Selector from '../common/Selector';
import TextInput from '../common/TextInput';
import TextArea from '../common/TextArea';
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';
import { changeTitle } from '../../services/utils';
const { intervals } = require('../../assets/json/static.json');

function NewCampaignComponent({ handleError }) {

  const nowRunning = 'Template.jsx';
  changeTitle('messagine: NewCampaign');
  
  const {
    setLoadingMessages,
    userId
  } = useOutletContext();

  const { 
    addLoadingMessage, 
    removeLoadingMessage 
  } = useLoadingMessages(setLoadingMessages);

  const [state, setState] = useState({
    lists: {},
    loaded: false,
  });

  const { 
    lists,
    loaded 
  } = state;

  const schema = Joi.object({
    active: Joi.boolean().required(),
    apiTesting: Joi.boolean().optional(),
    campaignEnds: Joi.date().optional().allow(null, ''),
    campaignInterval: Joi.number().required().integer().min(1).max(16),
    campaignName: Joi.string().required(),
    campaignNotes: Joi.string().optional().allow('', null),
    campaignRepeats: Joi.boolean().required(),
    campaignStarts: Joi.date().optional().allow(null, ''),
    listId: Joi.string().required().uuid(),
    messageSeries: Joi.boolean().optional(),
    unsubUrl: Joi.string().uri().required() 
  }).custom((value, helpers) => {
    const { 
      
      campaignStarts, campaignEnds } = value;
  
      // Check if both dates are either present or both are empty.
      const bothDatesEmpty = (!campaignStarts && !campaignEnds);
      const bothDatesPresent = (campaignStarts && campaignEnds);
    
      if (!bothDatesEmpty && !bothDatesPresent) { return helpers.error('any.invalid', { message: 'both dates needed' }); }
  
      return value; // No errors, return the validated value.
   
  }, 'Custom validation for campaignStarts and campaignEnds');
  
  
  const defaultValues = {
    active: true,
    campaignRepeats: false,
    messageSeries: false
  };

  const { 
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    trigger
  } = useForm({ resolver: joiResolver(schema), defaultValues });

  const navigate = useNavigate();

  const onChange = () => trigger();

  const onReset = () => { 
    reset(defaultValues);
    trigger();
  };

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`;
    const loadingMessage = 'creating the new campaign...';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'campaigns/new';
      const payload = { 
        ...data
      };
      payload.campaignEnds = moment(data.campaignEnds).unix();
      payload.campaignStarts = moment(data.campaignStarts).unix();
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
        return null;

      }

      toast.success('The new campaign was created.');
      removeLoadingMessage(loadingMessage);
      navigate('/campaigns/manage');

    } catch(error) {

      removeLoadingMessage(loadingMessage);
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

          setState((prevState) => ({
            ...prevState,
            loaded: true
          }));
          setValue('active', true);
          setValue('campaignRepeats', false);
          setValue('messageSeries', false);

          const api = 'lists/all';
          const payload = {};
          const { data } = await apiLoader({ api, payload });
          const {
            activeLists,
            failure,
            success
          } = data;

          if (!success) {

            handleError({
              failure,
              nowRunning: context,
              userId
            });
            return null;

          }

          setState((prevState) => ({
            ...prevState,
            lists: activeLists
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

        {!loaded && (<Loading className="loading" message="loading the THING..." />)}

        {loaded && (
          
          <>

            <Breadcrumb className="size-50 text-muted mb-3">

              <Breadcrumb.Item>campaigns</Breadcrumb.Item>
              <Breadcrumb.Item>new</Breadcrumb.Item>

            </Breadcrumb>

            <h5 className="floats">

              <div className="float-right ml-05">

                <OverlayTrigger
                  delay={ {  hide: 100, show: 200 } }
                  overlay={ (props) => (
                    <Tooltip { ...props }>
                      show all campaigns
                    </Tooltip>
                )}
                  placement="bottom"
                >

                  <a href="/campaigns/manage"><List /></a>
                  
                </OverlayTrigger>
                
              </div>
              
              new campaign

            </h5>

            <>

              <Form 
                className="bg-light p-3 mb-3"
                onSubmit={handleSubmit( onSubmit)}
              >

                <TextInput
                  errors={errors.campaignName}
                  inputName="campaignName"
                  label="name"
                  onChange={ () => trigger() }
                  placeholder="new campaign name..."
                  register={register}
                />

                <Row>

                  <Col xs={12} sm={6}>
                    <Selector
                      inputName="campaignInterval"
                      label="message interval"
                      onChange={onChange}
                      placeholder="please select an interval..."
                      register={register}
                      values={intervals}
                    />
                  </Col>

                  <Col xs={12} sm={6}>
                    <Selector
                      inputName="listId"
                      label="contact list"
                      onChange={onChange}
                      placeholder="please select a set of contacts..."
                      register={register}
                      values={lists}
                    />
                  </Col>

                  <Col xs={12} sm={6}>

                    <div className="size-65 text-muted mb-3">options</div>

                  <div className="floats">

                    <div className="float-left mr-1">

                      <CheckBoxInput
                        inputName="active"
                        label="active"
                        register={register}
                      />

                    </div>

                    <div className="float-left mr-1">

                      <CheckBoxInput
                        inputName="campaignRepeats"
                        label="repeats"
                        register={register}
                      />

                    </div>

                    <div className="float-left mr-1">

                      <CheckBoxInput
                        inputName="messageSeries"
                        label="message series"
                        register={register}
                      />

                    </div>

                  </div>
                  
                  </Col>

                </Row>

                <div className="floats">

                  <div className="float-left mr-1">

                    <div className="size-65 text-muted mb-2">
                      campaign starts
                      { " " }
                      {errors.date && (<RequiredField />) }
                    </div>
                    
                    <Controller
                      control={control}
                      name="campaignStarts"
                      render={({ field }) => (

                        <DatePicker
                          className="form-control mb-3 p-3 width-250px"
                          dateFormat="MMM d, yyyy h:mm aa"
                          onChange={(date) => {
                            field.onChange(date);
                            trigger();
                          }}
                          placeholderText="select date..."
                          portalId="root-portal"
                          selected={field.value ? new Date(field.value) : null}  // Ensure valid Date or null
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={60}
                          timezone="America/Los_Angeles"
                        />
                        
                      )}
                    />

                  </div>

                  <div className="float-left mr-1">

                    <div className="size-65 text-muted mb-2 width-250px">
                      campaign ends
                      { " " }
                      {errors.date && (<RequiredField />) }
                    </div>
                    
                    <Controller
                      control={control}
                      name="campaignEnds"
                      render={({ field }) => (

                        <DatePicker
                          className="form-control mb-3 p-3 width-250px"
                          dateFormat="MMM d, yyyy h:mm aa"
                          onChange={(date) => {
                            field.onChange(date);
                            trigger();
                          }}
                          placeholderText="select date..."
                          portalId="root-portal"
                          selected={field.value ? new Date(field.value) : null}  // Ensure valid Date or null
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={60}
                          timezone="America/Los_Angeles"
                        />
                      )}

                    />
                    
                  </div>

                </div>

                <TextInput
                  errors={errors.unsubUrl}
                  inputName="unsubUrl"
                  label="unsubscribe link"
                  onChange={ () => trigger() }
                  placeholder="unsubscribe link required..."
                  register={register}
                />
                
                <TextArea
                  inputName="campaignNotes"
                  label="notes"
                  placeholder="optional notes about the campaign..."
                  register={register}
                />

                <FormButtons
                  errors={errors}
                  onReset={onReset}
                  submitText="create campaign"
                />

              </Form>

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

export default function NewCampaign(props) {

  const defaultProps = {
    ...props,
    defaultError: "The new campaign tool isn't working right now.",
    errorNumber: 65
  };

  return (

    <ErrorBoundary
      context="campaigns/NewCampaign.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <NewCampaignComponent {...defaultProps} />
    </ErrorBoundary>

  );

}
