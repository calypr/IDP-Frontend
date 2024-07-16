import React, { useRef } from 'react';
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
  const svgRef = useRef(); // directly reference the SVG and tooltip elements
  const tooltipRef = useRef(); // directly reference the SVG and tooltip elements

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
    const width = 1000 - margin.left - margin.right;
    const height = 800 - margin.top - margin.bottom;

    // Don't need to sort data, it is returned sorted. Sort data from small to large
    //let histogramData = queryData.sort((a, b) => a.count - b.count);
    let histogramData = queryData;

    // Filter data within a range
    histogramData = Array.isArray(histogramData)
      ? histogramData.filter((d) => d.count >= 3 && d.count <= 108)
      : [];

    // Remove any existing SVG to avoid duplication
    d3.select(svgRef.current).selectAll('*').remove();
    // Create canvas
    const svg = d3
      .select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

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
      .range([0, height])
      .padding(0.1);

    // Create axes
    const xAxis = d3.axisBottom(x).ticks(10);
    const yAxis = d3.axisLeft(y);

    // Tooltip initialization
    //
    const tooltip = d3
      .select(tooltipRef.current) // ensure tooltip is referenced correctly
      .style('opacity', 0);

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
        tooltip.transition().duration(200).style('opacity', 0.9); // position relative to mouse pointer
        tooltip
          .html(`${d.key}<br>Count: ${d.count}`)
          .style('left', `${event.pageX - 100}px`)
          .style('top', `${event.pageY - 125}px`);
      })
      .on('mousemove', function (event) {
        tooltip
          .style('left', `${event.pageX - 100}px`) // readability: slight right of mouse
          .style('top', `${event.pageY - 125}px`); // readability: slight above of mouse
      })
      .on('mouseout', function () {
        tooltip.transition().duration(500).style('opacity', 0); //fade out (500 milliseconds) when mouse leaves the bar-chart
      });

    // Append axes to SVG
    g.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0, ${height})`)
      .call(xAxis);

    g.append('g').attr('class', 'y axis').call(yAxis);

    // Tooltip
  }, []); // Dependency array ensures useEffect runs only when these props change

  if (isError || isLoading) {
    return <ErrorCard message={'Error occurred while fetching data'} />;
  }

  return (
    <NavPageLayout headerProps={headerProps} footerProps={footerProps}>
      <svg ref={svgRef}></svg>
      <div ref={tooltipRef} className="tooltip"></div>{' '}
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
