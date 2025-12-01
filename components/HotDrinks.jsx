import React from "react";
import styled from "styled-components";

const StyledHotdrinks = styled.span`
  color: white;
  font-size: 26.718px;
  font-family: 'Pecita', cursive;
  font-weight: 400;
  line-height: normal;
  text-transform: uppercase;
  white-space: pre-wrap;
`;

export const HotDrinks = () => {
  return (
    <StyledHotdrinks>hot drinks</StyledHotdrinks>
  );
};

