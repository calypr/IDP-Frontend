import React from 'react';
import { Center, Text, Paper } from '@mantine/core';
import { useGeneralGQLQuery } from '@gen3/core';
import {
  NavPageLayout,
  NavPageLayoutProps,
  getNavPageLayoutPropsFromConfig,
  ErrorCard,
} from '@gen3/frontend';
import { GetServerSideProps } from 'next';
import { useEffect } from 'react';
import * as d3 from 'd3';

const countsQuery = (countsProperty: string) => {
  const props_query = {
    query: `query ($filter: JSON) {
      _aggregation{
        observation(filter: $filter accessibility:all) {
          ${countsProperty}{
            histogram {
              key
              count
            }
          }
        }
      }
    }`,
    variables: {
      filter: {
        AND: [
          {
            IN: {
              project_id: ['ohsu-smmart_labkey'],
            },
          },
        ],
      },
    },
  };
  return props_query;
};
interface HistogramData {
  key: string;
  count: number;
}

interface Observation {
  [key: string]: {
    histogram: HistogramData[];
    _cardinalityCount?: number;
  };
}

interface QueryResponse {
  data?: Record<string, Observation[]>;
  countsProperty?: string;
}

const extractData = (
  data: QueryResponse,
  countsProperty: string,
  returnType: 'histogram' | 'totalCounts',
): HistogramData[] | number => {
  if (!data || !data.data || !data.data._aggregation || !countsProperty) {
    return returnType === 'histogram' ? [] : 0;
  }

  const allObservations = Object.values(data.data._aggregation).flat();
  const targetObservation = allObservations.find(
    (observation) => observation[countsProperty],
  );

  if (!targetObservation) {
    return returnType === 'histogram' ? [] : 0;
  }

  if (returnType === 'histogram') {
    return Array.isArray(targetObservation[countsProperty].histogram)
      ? targetObservation[countsProperty].histogram
      : [];
  } else if (targetObservation && targetObservation[countsProperty]) {
    const cardinalityCount =
      targetObservation[countsProperty]!._cardinalityCount;
    if (typeof cardinalityCount === 'number') {
      return cardinalityCount;
    }
  }
  return 0;
};

const isQueryResponse = (obj: any): obj is QueryResponse => {
  return (
    typeof obj === 'object' &&
    (obj.data === undefined || typeof obj.data === 'object')
  );
};
const D3Page = ({ headerProps, footerProps }: NavPageLayoutProps) => {
  const { data, isLoading, isError } = useGeneralGQLQuery(
    countsQuery('product_notes_project_id'),
  );

  const queryData = isQueryResponse(data)
    ? extractData(data, 'product_notes_project_id', 'histogram')
    : [];

  useEffect(() => {
    if (isError || isLoading) {
      return;
    }

    if (!queryData) {
      return;
    }

    // Margin for chart area
    const margin = { left: 150, right: 30, top: 20, bottom: 60 };
    const width = 1000;
    const height = 800;

    // Don't need to sort data, it is returned sorted. Sort data from small to large
    //let histogramData = queryData.sort((a, b) => a.count - b.count);
    let histogramData = queryData;

    // Filter data within a range
    histogramData = Array.isArray(histogramData)
      ? histogramData.filter((d) => d.count >= 3 && d.count <= 108)
      : [];

    // Calculate height based on data points
    const barHeight = 20; // height of each bar
    const barSpacing = 5; // spacing between bars
    const svgHeight =
      histogramData.length * (barHeight + barSpacing) -
      barSpacing +
      margin.top +
      margin.bottom;

    // Remove any existing SVG to avoid duplication
    d3.select('#chart-area').selectAll('*').remove();

    // Create canvas
    const svg = d3
      .select('#chart-area')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', svgHeight);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Create scales
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(histogramData, (d) => d.count)])
      .range([0, width]);

    const y = d3
      .scaleBand()
      .domain(histogramData.map((d) => d.key))
      .range([0, svgHeight - margin.top - margin.bottom])
      .padding(0.1);

    // Create axes
    const xAxis = d3.axisBottom(x).ticks(10);
    const yAxis = d3.axisLeft(y);

    // Append bars
    g.selectAll('.bar')
      .data(histogramData)
      .enter()
      .append('rect')
      .attr('class', 'bar fill-current text-blue-800') // Add Tailwind CSS classes
      .attr('x', 0)
      .attr('y', (d) => y(d.key))
      .attr('width', (d) => x(d.count))
      .attr('height', y.bandwidth())
      .on('mouseover', function (event, d) {
        d3.select(this).classed('text-lightblue-400', true); // Add hover class using D3
        tooltip.transition().duration(200).style('opacity', 0.9);
        tooltip
          .html(`${d.key}<br>Count: ${d.count}`)
          .style('left', `${event.pageX + 5}px`)
          .style('top', `${event.pageY - 28}px`);
      })
      .on('mouseout', function () {
        d3.select(this).classed('text-lightblue-400', false); // Remove hover class using D3
        tooltip.transition().duration(500).style('opacity', 0);
      });

    // Append axes to SVG
    g.append('g')
      .attr('class', 'x axis')
      .attr(
        'transform',
        `translate(0, ${svgHeight - margin.top - margin.bottom})`,
      )
      .call(xAxis);

    g.append('g').attr('class', 'y axis').call(yAxis);

    // Tooltip
    const tooltip = d3
      .select('body')
      .append('div')
      .attr(
        'class',
        'tooltip absolute text-center w-36 h-6 p-0.5 text-xs bg-lightblue-400 rounded-md',
      )
      .style('pointer-events', 'none')
      .style('opacity', 0);
  }, [data, isError, isLoading]); // Dependency array ensures useEffect runs only when these props change

  if (isError || isLoading) {
    return <ErrorCard message={'Error occurred while fetching data'} />;
  }

  return (
    <NavPageLayout headerProps={headerProps} footerProps={footerProps}>
      <div id="chart-area"></div>
    </NavPageLayout>
  );
};

// TODO: replace this with a custom getServerSideProps function
export const getServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
    },
  };
};

export default D3Page;
