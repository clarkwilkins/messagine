import { 
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

function PieCharts( props ) {
 
  let {
    chartLabel,
    color1,
    cx,
    cy,
    dataset,
    height,
    innerRadius,
    key1,
    outerRadius,
    name1,
  } = props;

  if ( outerRadius ) height = outerRadius * 2.8;

  if ( !color1 ) color1 = "#8884d8";

  if ( !cx ) cx = '50%';

  if ( !cy ) cy = '50%';
 
  if ( !height ) height = 400;

  return (

    <div className="mt-3 mb-3">

      <div className="size-65">{chartLabel}</div>

      <div className="size-65">

        <ResponsiveContainer width="100%" height={height}>

          <PieChart>

            <Pie 
              cx={cx} 
              cy={cy} 
              data={dataset} 
              dataKey={key1} 
              fill={color1}
              innerRadius={innerRadius}
              nameKey={name1} 
              outerRadius={outerRadius} 
              label={ ({ name }) => `${name} (${(dataset.find(item => item.name === name)?.value || 0)})` }
            />

            <Tooltip />

          </PieChart>
          
        </ResponsiveContainer>

      </div>

    </div>
      
  );
}

export default PieCharts;